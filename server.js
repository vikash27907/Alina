/**
 * funwithu.in — custom server
 * Runs Next.js and Socket.IO on one port.
 *
 * Socket.IO handles the live layer:
 *  - matching queue (paying customers <-> online approved models)
 *  - WebRTC signaling relay (offer/answer/ICE)
 *  - in-call text chat + gifts
 *  - per-tick coin billing (customer spends, model earns), hard stop at 0 coins
 */
const { createServer } = require("http");
const next = require("next");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";
if (
  !dev &&
  (!process.env.AUTH_SECRET ||
    process.env.AUTH_SECRET.includes("change-me") ||
    process.env.AUTH_SECRET.length < 32)
) {
  console.error(
    "FATAL: AUTH_SECRET must be set to a random string of 32+ characters in production.\n" +
      "Generate one with: openssl rand -base64 48"
  );
  process.exit(1);
}

// Economy — mirrors lib/economy.ts. Customers pay in coins; models earn paise.
const CALL_RATE = 10; // coins/min a customer spends
const MODEL_RATE_PAISE = 300; // ₹3/min to the model
const LOYALTY_MIN = 10; // from this minute of the same call...
const LOYALTY_BONUS_PAISE = 100; // ...+₹1/min
const GIFT_PAYOUT_PCT = 30; // model keeps 30% of a gift's ₹ value
const GIFTS = { rose: 10, kiss: 25, ring: 100, crown: 500 }; // coin costs
// Billing cadence. 60s in production; override (e.g. 500) to test fast.
const BILL_INTERVAL_MS = parseInt(process.env.BILL_INTERVAL_MS || "60000", 10);
const STALE_CALL_MS = 90_000; // a call with no successful tick in 90s is auto-ended
const LIVE_VIEWER_CAP = 6; // max concurrent viewers per live room (WebRTC mesh limit)

// ---------- automated content moderation ----------
// Explicit-content filter for text (English + common Hindi transliterations).
// Extend this list from the admin side as patterns emerge.
const EXPLICIT = new RegExp(
  "\\b(" +
    [
      "nudes?", "naked", "nangi", "nanga", "porn\\w*", "sex", "sexting",
      "boobs?", "tits?", "nipples?", "pussy", "vagina", "penis", "dick",
      "cock", "lund", "chut\\w*", "bhos\\w*", "gaand", "blowjob", "handjob",
      "anal", "cum", "cumming", "masturbat\\w*", "striptease", "stripping",
      "randi", "raand", "madarchod", "behenchod", "bhenchod", "chudai",
      "escort", "prostitut\\w*", "onlyfans"
    ].join("|") +
    ")\\b",
  "i"
);
const isExplicit = (text) => EXPLICIT.test(text);

// warnings → timed cooldown bans (1 min → 5 min → 30 min) → 24h suspension
const COOLDOWN_LEVELS = [60, 300, 1800]; // seconds
const chatStrikes = new Map(); // uid -> { count, level, resetAt }
const cooldownUntil = new Map(); // uid -> timestamp ms

function onCooldown(uid) {
  const t = cooldownUntil.get(uid);
  if (!t) return 0;
  const rem = t - Date.now();
  if (rem <= 0) {
    cooldownUntil.delete(uid);
    return 0;
  }
  return Math.ceil(rem / 1000);
}

async function addStrike(io, socket) {
  const uid = socket.data.uid;
  const now = Date.now();
  let s = chatStrikes.get(uid);
  if (!s || s.resetAt < now)
    s = { count: 0, level: s ? s.level : 0, resetAt: now + 3600_000 };
  s.count += 1;
  chatStrikes.set(uid, s);

  if (s.count < 3) {
    socket.emit("mod:warning", {
      strikes: s.count,
      max: 3,
      message:
        "Explicit content is not allowed on FunWithU. Further violations will time you out.",
    });
    return;
  }

  s.count = 0;
  if (s.level >= COOLDOWN_LEVELS.length) {
    // repeated offender — 24h account suspension, visible to admin
    try {
      await prisma.user.update({
        where: { id: uid },
        data: {
          status: "SUSPENDED",
          suspendedUntil: new Date(now + 24 * 3600_000),
        },
      });
      await prisma.auditLog.create({
        data: {
          actorId: "system",
          action: "AUTO_SUSPEND_CHAT",
          target: uid,
          detail: "repeated explicit-content violations (auto-moderation)",
        },
      });
    } catch (e) {
      console.error("auto-suspend error", e);
    }
    socket.emit("mod:banned", { seconds: 24 * 3600 });
    socket.disconnect(true);
    return;
  }

  const secs = COOLDOWN_LEVELS[s.level];
  s.level += 1;
  cooldownUntil.set(uid, now + secs * 1000);
  socket.emit("mod:banned", { seconds: secs });

  const call = activeCalls.get(socket.data.callId);
  if (call) endCall(io, call, "moderation");
  waitingCustomers.delete(uid);
  availableModels.delete(uid);
  if (liveRooms.has(uid)) stopLive(io, uid, "moderation");
}

// too many reports in a short window → automatic 30-min timeout pending review
async function reportThreshold(io, reportedUid) {
  const since = new Date(Date.now() - 15 * 60_000);
  const count = await prisma.report.count({
    where: { reportedId: reportedUid, createdAt: { gte: since } },
  });
  if (count < 3) return;
  cooldownUntil.set(reportedUid, Date.now() + 30 * 60_000);
  waitingCustomers.delete(reportedUid);
  availableModels.delete(reportedUid);
  if (liveRooms.has(reportedUid)) stopLive(io, reportedUid, "moderation");
  await prisma.auditLog
    .create({
      data: {
        actorId: "system",
        action: "AUTO_TEMPBAN_REPORTS",
        target: reportedUid,
        detail: `${count} reports within 15 minutes — 30 min timeout, review reports queue`,
      },
    })
    .catch(() => {});
}

// ---------- live streaming ----------
/** modelUid -> { modelUid, modelName, modelProfileId, modelSocket, vip, viewers: Map<socketId, socket> } */
const liveRooms = new Map();
let ioRef = null;

function liveList() {
  return [...liveRooms.values()].map((r) => ({
    uid: r.modelUid,
    name: r.modelName,
    vip: r.vip,
    viewers: r.viewers.size,
  }));
}
function broadcastLiveList(io) {
  io.emit("live:list", liveList());
}
function stopLive(io, modelUid, reason) {
  const room = liveRooms.get(modelUid);
  if (!room) return;
  liveRooms.delete(modelUid);
  for (const v of room.viewers.values()) {
    v.data.watching = null;
    v.emit("live:ended", { reason });
  }
  for (const s of room.queue || []) {
    s.data.queuedIn = null;
    s.emit("live:ended", { reason });
  }
  if (room.modelSocket?.connected) room.modelSocket.emit("live:ended", { reason });
  broadcastLiveList(io);
}

// subscribe a viewer to a room (assumes there is space)
function admitViewer(io, room, socket) {
  room.viewers.set(socket.id, socket);
  socket.data.watching = room.modelUid;
  socket.data.watchSince = Date.now();
  room.modelSocket.emit("live:viewer", { sid: socket.id, count: room.viewers.size });
  socket.emit("live:joined", {
    model: room.modelName,
    vip: room.vip,
    count: room.viewers.size,
  });
  broadcastLiveList(io);
}

function updateQueuePositions(room) {
  room.queue.forEach((s, i) =>
    s.emit("live:queued", { model: room.modelName, position: i + 1 })
  );
}

// fill free slots from the head of the FIFO queue
function admitFromQueue(io, room) {
  while (room.viewers.size < LIVE_VIEWER_CAP && room.queue.length) {
    const next = room.queue.shift();
    if (!next || !next.connected) continue;
    if (room.vip && !next.data.isPayer) {
      next.data.queuedIn = null;
      next.emit("live:kicked", { reason: "vip", message: "This stream is now VIP-only." });
      continue;
    }
    next.data.queuedIn = null;
    admitViewer(io, room, next);
  }
  updateQueuePositions(room);
}

function leaveLive(io, socket) {
  // remove from any queue first
  const qm = socket.data.queuedIn;
  if (qm) {
    const qr = liveRooms.get(qm);
    if (qr) {
      qr.queue = qr.queue.filter((s) => s !== socket);
      updateQueuePositions(qr);
    }
    socket.data.queuedIn = null;
  }
  const m = socket.data.watching;
  if (!m) return;
  socket.data.watching = null;
  const room = liveRooms.get(m);
  if (!room) return;
  room.viewers.delete(socket.id);
  room.modelSocket.emit("live:viewer-left", {
    sid: socket.id,
    count: room.viewers.size,
  });
  admitFromQueue(io, room); // a slot freed → pull the next in line
  broadcastLiveList(io);
}

const prisma = new PrismaClient();
const app = next({ dev });
const handle = app.getRequestHandler();

/** userId -> socket, models who pressed "Go online" and are not in a call */
const availableModels = new Map();
/** userId -> socket, customers waiting for a partner */
const waitingCustomers = new Map();
/** callId -> live call state */
const activeCalls = new Map();

function parseCookie(header, name) {
  if (!header) return null;
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

async function endCall(io, call, reason) {
  if (!activeCalls.has(call.id)) return;
  activeCalls.delete(call.id);
  clearInterval(call.timer);

  const seconds = Math.round((Date.now() - call.startedAt) / 1000);
  try {
    // minutes and money were already persisted per-tick; just close the record
    await prisma.call.update({
      where: { id: call.dbId },
      data: { endedAt: new Date(), seconds, endReason: reason },
    });
  } catch (e) {
    console.error("endCall persist error", e);
  }

  io.to(call.room).emit("call:ended", { reason });
  const cs = call.customerSocket;
  const ms = call.modelSocket;
  if (cs) {
    cs.leave(call.room);
    cs.data.callId = null;
  }
  if (ms) {
    ms.leave(call.room);
    ms.data.callId = null;
    // model returns to the pool automatically if still connected & online
    if (ms.connected && ms.data.wantsOnline) {
      availableModels.set(ms.data.uid, ms);
      tryMatch(io);
    }
  }
}

async function startCall(io, customerSocket, modelSocket) {
  const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const room = `call:${callId}`;

  const dbCall = await prisma.call.create({
    data: {
      customerId: customerSocket.data.uid,
      modelId: modelSocket.data.modelProfileId,
    },
  });

  const isTrial = !!customerSocket.data.trial;
  if (isTrial) {
    await prisma.call
      .update({ where: { id: dbCall.id }, data: { isTrial: true } })
      .catch(() => {});
  }

  const call = {
    id: callId,
    dbId: dbCall.id,
    room,
    customerSocket,
    modelSocket,
    modelProfileId: modelSocket.data.modelProfileId,
    customerId: customerSocket.data.uid,
    isTrial,
    startedAt: Date.now(),
    lastTickAt: Date.now(),
    coinsSpent: 0,
    modelEarn: 0, // paise
    minute: 0,
    timer: null,
  };
  activeCalls.set(callId, call);
  customerSocket.data.callId = callId;
  modelSocket.data.callId = callId;
  customerSocket.join(room);
  modelSocket.join(room);

  io.to(room).emit("matched", {
    callId,
    customer: { name: customerSocket.data.name },
    model: { name: modelSocket.data.name },
    initiator: customerSocket.data.uid, // customer is the WebRTC initiator
    coinsPerMin: CALL_RATE,
    trial: isTrial,
  });

  if (isTrial) {
    // free 1-minute trial: no billing, auto-ends with an upsell after 60s
    customerSocket.data.trial = false;
    prisma.user
      .update({
        where: { id: call.customerId },
        data: { trialMinutesLeft: { decrement: 1 } },
      })
      .catch((e) => console.error("trial decrement", e));
    prisma.trialCall
      .create({
        data: {
          userId: call.customerId,
          modelProfileId: call.modelProfileId,
          callId: call.dbId,
        },
      })
      .catch((e) => console.error("trialCall record", e));
    call.timer = setTimeout(() => endCall(io, call, "trial-ended"), 60_000);
    return;
  }

  // Paid call: bill one whole minute per interval. Each tick is one atomic DB
  // transaction, so a crash mid-call loses at most one un-billed minute.
  call.timer = setInterval(() => billMinute(io, call), BILL_INTERVAL_MS);
}

async function billMinute(io, call) {
  const n = call.minute + 1;
  const credit = MODEL_RATE_PAISE + (n >= LOYALTY_MIN ? LOYALTY_BONUS_PAISE : 0);
  try {
    await prisma.$transaction(async (tx) => {
      // atomic, race-safe debit: only succeeds if the wallet can afford it
      const debit = await tx.user.updateMany({
        where: { id: call.customerId, coins: { gte: CALL_RATE } },
        data: { coins: { decrement: CALL_RATE } },
      });
      if (debit.count === 0) {
        const err = new Error("OUT_OF_COINS");
        err.code = "OUT_OF_COINS";
        throw err;
      }
      await tx.transaction.create({
        data: {
          userId: call.customerId,
          type: "CALL_SPEND",
          coins: -CALL_RATE,
          meta: call.dbId,
        },
      });
      await tx.modelProfile.update({
        where: { id: call.modelProfileId },
        data: {
          earnings: { increment: credit },
          balance: { increment: credit },
          totalMinutes: { increment: 1 },
        },
      });
      await tx.modelEarning.create({
        data: {
          modelProfileId: call.modelProfileId,
          type: "call",
          amountPaise: credit,
          callId: call.dbId,
          minuteNo: n,
        },
      });
      await tx.call.update({
        where: { id: call.dbId },
        data: {
          coinsSpent: { increment: CALL_RATE },
          modelEarn: { increment: credit },
          minutesBilled: n,
          seconds: n * 60,
        },
      });
    });
  } catch (e) {
    if (e.code === "OUT_OF_COINS") {
      await endCall(io, call, "out-of-coins");
    } else {
      console.error("billing tick error", e);
    }
    return;
  }

  call.minute = n;
  call.coinsSpent += CALL_RATE;
  call.modelEarn += credit;
  call.lastTickAt = Date.now();

  const updated = await prisma.user.findUnique({
    where: { id: call.customerId },
    select: { coins: true },
  });
  call.customerSocket.emit("wallet", { coins: updated?.coins ?? 0 });
  call.modelSocket.emit("earned", { totalPaise: call.modelEarn, minute: n });
}

async function isBlocked(a, b) {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return !!block;
}

let matchingBusy = false;
async function tryMatch(io) {
  if (matchingBusy) return;
  matchingBusy = true;
  try {
    for (const [cid, customerSocket] of [...waitingCustomers]) {
      if (!customerSocket.connected) {
        waitingCustomers.delete(cid);
        continue;
      }
      for (const [mid, modelSocket] of [...availableModels]) {
        if (!modelSocket.connected) {
          availableModels.delete(mid);
          continue;
        }
        if (await isBlocked(cid, mid)) continue; // blocked pair — try next model
        waitingCustomers.delete(cid);
        availableModels.delete(mid);
        await startCall(io, customerSocket, modelSocket).catch((e) =>
          console.error("startCall error", e)
        );
        break;
      }
    }
  } finally {
    matchingBusy = false;
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const io = new Server(server, { path: "/rtc" });

  // authenticate sockets from the same JWT cookie the web app uses.
  // guests (no token) are allowed read-only access to public live streams.
  io.use(async (socket, nextFn) => {
    const token = parseCookie(socket.request.headers.cookie, "fwu_token");
    if (!token) {
      socket.data.guest = true;
      socket.data.uid = `guest:${socket.id}`;
      socket.data.name = "Guest";
      socket.data.role = "GUEST";
      socket.data.isPayer = false;
      return nextFn();
    }
    let payload;
    try {
      payload = jwt.verify(token, SECRET);
    } catch {
      return nextFn(new Error("unauthorized"));
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.uid },
      include: { modelProfile: true },
    });
    if (!user) return nextFn(new Error("unauthorized"));
    socket.data.isPayer = !!(await prisma.transaction.findFirst({
      where: { userId: user.id, type: "PURCHASE" },
      select: { id: true },
    }));
    if (user.status === "BANNED") return nextFn(new Error("banned"));
    if (
      user.status === "SUSPENDED" &&
      user.suspendedUntil &&
      user.suspendedUntil > new Date()
    )
      return nextFn(new Error("suspended"));
    socket.data.uid = user.id;
    socket.data.name = user.name;
    socket.data.role = user.role;
    socket.data.modelProfileId = user.modelProfile?.id || null;
    socket.data.modelApproved = user.modelProfile?.status === "APPROVED";
    nextFn();
  });

  io.on("connection", (socket) => {
    const guarded = (fn) => (...args) => {
      if (socket.data.guest) return;
      fn(...args);
    };

    // ---- model side ----
    socket.on("model:online", guarded(() => {
      if (onCooldown(socket.data.uid)) {
        socket.emit("mod:banned", { seconds: onCooldown(socket.data.uid) });
        return;
      }
      if (!socket.data.modelApproved) {
        socket.emit("error:msg", "Your model account is not approved yet.");
        return;
      }
      socket.data.wantsOnline = true;
      availableModels.set(socket.data.uid, socket);
      socket.emit("model:status", { online: true });
      tryMatch(io);
    }));

    socket.on("model:offline", () => {
      socket.data.wantsOnline = false;
      availableModels.delete(socket.data.uid);
      socket.emit("model:status", { online: false });
    });

    // ---- customer side ----
    socket.on("find", guarded(async () => {
      const cd = onCooldown(socket.data.uid);
      if (cd) {
        socket.emit("mod:banned", { seconds: cd });
        return;
      }
      const user = await prisma.user.findUnique({
        where: { id: socket.data.uid },
        select: { coins: true, trialMinutesLeft: true },
      });
      // a free trial minute counts as "can call" even with an empty wallet
      const canTrial = (user?.trialMinutesLeft ?? 0) > 0;
      if (!user || (user.coins < CALL_RATE && !canTrial)) {
        socket.emit("error:msg", "You need more coins to start a video chat.");
        return;
      }
      socket.data.trial = user.coins < CALL_RATE && canTrial;
      waitingCustomers.set(socket.data.uid, socket);
      socket.emit("searching");
      tryMatch(io);
    }));

    socket.on("find:cancel", () => {
      waitingCustomers.delete(socket.data.uid);
      socket.emit("search:cancelled");
    });

    // ---- shared: in-call ----
    socket.on("signal", (data) => {
      const call = activeCalls.get(socket.data.callId);
      if (!call) return;
      socket.to(call.room).emit("signal", data);
    });

    socket.on("chat:msg", guarded((text) => {
      const call = activeCalls.get(socket.data.callId);
      if (!call || typeof text !== "string" || !text.trim()) return;
      const cd = onCooldown(socket.data.uid);
      if (cd) {
        socket.emit("mod:banned", { seconds: cd });
        return;
      }
      if (isExplicit(text)) {
        addStrike(io, socket);
        return;
      }
      io.to(call.room).emit("chat:msg", {
        from: socket.data.name,
        self: socket.id,
        text: text.slice(0, 500),
      });
    }));

    socket.on("gift:send", async (giftId) => {
      const call = activeCalls.get(socket.data.callId);
      const cost = GIFTS[giftId];
      if (!call || !cost || socket.data.uid !== call.customerSocket.data.uid)
        return;
      const user = await prisma.user.findUnique({
        where: { id: socket.data.uid },
        select: { coins: true },
      });
      if (!user || user.coins < cost) {
        socket.emit("error:msg", "Not enough coins for that gift.");
        return;
      }
      const creditPaise = cost * GIFT_PAYOUT_PCT; // 30% of ₹value, in paise
      call.coinsSpent += cost;
      call.modelEarn += creditPaise;
      await prisma.$transaction([
        prisma.user.update({
          where: { id: socket.data.uid },
          data: { coins: { decrement: cost } },
        }),
        prisma.modelProfile.update({
          where: { id: call.modelProfileId },
          data: {
            earnings: { increment: creditPaise },
            balance: { increment: creditPaise },
          },
        }),
        prisma.modelEarning.create({
          data: {
            modelProfileId: call.modelProfileId,
            type: "gift",
            amountPaise: creditPaise,
            callId: call.dbId,
          },
        }),
        prisma.transaction.create({
          data: {
            userId: socket.data.uid,
            type: "GIFT_SPEND",
            coins: -cost,
            meta: giftId,
          },
        }),
      ]);
      const updated = await prisma.user.findUnique({
        where: { id: socket.data.uid },
        select: { coins: true },
      });
      socket.emit("wallet", { coins: updated?.coins ?? 0 });
      call.modelSocket.emit("earned", { totalPaise: call.modelEarn });
      io.to(call.room).emit("gift:received", { giftId, from: socket.data.name });
    });

    socket.on("call:end", () => {
      const call = activeCalls.get(socket.data.callId);
      if (call) endCall(io, call, "ended-by-user");
    });

    // report the current call partner (works for both sides)
    socket.on("report", async ({ reason, detail } = {}) => {
      const call = activeCalls.get(socket.data.callId);
      if (!call || typeof reason !== "string" || !reason.trim()) return;
      const isCustomer = socket.data.uid === call.customerSocket.data.uid;
      const reportedId = isCustomer
        ? call.modelSocket.data.uid
        : call.customerSocket.data.uid;
      try {
        await prisma.report.create({
          data: {
            reporterId: socket.data.uid,
            reportedId,
            callId: call.dbId,
            reason: String(reason).slice(0, 100),
            detail: String(detail || "").slice(0, 500),
          },
        });
        socket.emit("report:ok");
        await reportThreshold(io, reportedId);
      } catch (e) {
        console.error("report error", e);
      }
    });

    // block the current call partner and end the call
    socket.on("block:partner", async () => {
      const call = activeCalls.get(socket.data.callId);
      if (!call) return;
      const isCustomer = socket.data.uid === call.customerSocket.data.uid;
      const blockedId = isCustomer
        ? call.modelSocket.data.uid
        : call.customerSocket.data.uid;
      try {
        await prisma.block.upsert({
          where: {
            blockerId_blockedId: { blockerId: socket.data.uid, blockedId },
          },
          update: {},
          create: { blockerId: socket.data.uid, blockedId },
        });
        socket.emit("block:ok");
      } catch (e) {
        console.error("block error", e);
      }
      endCall(io, call, "ended-by-user");
    });

    // ---- live streaming ----
    socket.on("live:list:get", () => socket.emit("live:list", liveList()));

    socket.on("live:start", guarded(async ({ vip } = {}) => {
      if (!socket.data.modelApproved) {
        socket.emit("error:msg", "Only approved models can go live.");
        return;
      }
      const cd = onCooldown(socket.data.uid);
      if (cd) {
        socket.emit("mod:banned", { seconds: cd });
        return;
      }
      if (liveRooms.has(socket.data.uid)) return;
      availableModels.delete(socket.data.uid);
      socket.data.wantsOnline = false;
      liveRooms.set(socket.data.uid, {
        modelUid: socket.data.uid,
        modelName: socket.data.name,
        modelProfileId: socket.data.modelProfileId,
        modelSocket: socket,
        vip: !!vip,
        viewers: new Map(),
        queue: [],
      });
      socket.emit("live:started", { vip: !!vip });
      broadcastLiveList(io);
    }));

    socket.on("live:stop", guarded(() => stopLive(io, socket.data.uid, "ended")));

    socket.on("live:vip", guarded(({ vip } = {}) => {
      const room = liveRooms.get(socket.data.uid);
      if (!room) return;
      room.vip = !!vip;
      if (room.vip) {
        // drop free viewers AND free users waiting in the queue
        for (const [sid, v] of [...room.viewers]) {
          if (!v.data.isPayer) {
            room.viewers.delete(sid);
            v.data.watching = null;
            v.emit("live:kicked", { reason: "vip" });
          }
        }
        for (const s of [...room.queue]) {
          if (!s.data.isPayer) {
            s.data.queuedIn = null;
            s.emit("live:kicked", { reason: "vip" });
          }
        }
        room.queue = room.queue.filter((s) => s.data.isPayer);
        admitFromQueue(io, room); // paying waiters can now come in
        socket.emit("live:viewers", { count: room.viewers.size });
      }
      socket.emit("live:vip:set", { vip: room.vip });
      broadcastLiveList(io);
    }));

    socket.on("live:join", ({ model } = {}) => {
      const room = liveRooms.get(model);
      if (!room) {
        socket.emit("live:error", { code: "gone", message: "This stream has ended." });
        return;
      }
      if (room.vip && !socket.data.isPayer) {
        socket.emit("live:error", {
          code: "vip",
          message: "This is a VIP stream — only members who have purchased coins can join.",
        });
        return;
      }
      leaveLive(io, socket); // clear any previous room/queue membership

      if (room.viewers.size < LIVE_VIEWER_CAP) {
        admitViewer(io, room, socket);
        return;
      }

      // Room is full. A paying customer bumps the longest-watching free viewer.
      if (socket.data.isPayer) {
        let victim = null;
        let oldest = Infinity;
        for (const v of room.viewers.values()) {
          if (!v.data.isPayer && (v.data.watchSince ?? 0) < oldest) {
            oldest = v.data.watchSince ?? 0;
            victim = v;
          }
        }
        if (victim) {
          room.viewers.delete(victim.id);
          victim.data.watching = null;
          room.modelSocket.emit("live:viewer-left", {
            sid: victim.id,
            count: room.viewers.size,
          });
          admitViewer(io, room, socket);
          // send the bumped free viewer to the front of the queue
          room.queue.unshift(victim);
          victim.data.queuedIn = room.modelUid;
          victim.emit("live:kicked", {
            reason: "vip-bump",
            message: "A VIP took your spot — you're first in the queue.",
          });
          updateQueuePositions(room);
          return;
        }
      }

      // Otherwise wait in line (queue is a feature: VIPs skip it).
      if (!room.queue.includes(socket)) room.queue.push(socket);
      socket.data.queuedIn = model;
      socket.emit("live:queued", {
        model: room.modelName,
        position: room.queue.indexOf(socket) + 1,
      });
    });

    socket.on("live:leave", () => leaveLive(io, socket));

    // signaling relay: broadcaster targets a viewer sid; viewers target their broadcaster
    socket.on("live:signal", ({ to, data } = {}) => {
      if (!data) return;
      const own = liveRooms.get(socket.data.uid);
      if (own && to && own.viewers.has(to)) {
        own.viewers.get(to).emit("live:signal", { from: socket.id, data });
        return;
      }
      const watching = liveRooms.get(socket.data.watching);
      if (watching)
        watching.modelSocket.emit("live:signal", { from: socket.id, data });
    });

    socket.on("live:comment", (text) => {
      if (socket.data.guest) {
        socket.emit("error:msg", "Join free to comment on live streams.");
        return;
      }
      const room =
        liveRooms.get(socket.data.watching) || liveRooms.get(socket.data.uid);
      if (!room || typeof text !== "string" || !text.trim()) return;
      const cd = onCooldown(socket.data.uid);
      if (cd) {
        socket.emit("mod:banned", { seconds: cd });
        return;
      }
      if (isExplicit(text)) {
        addStrike(io, socket);
        return;
      }
      const msg = { from: socket.data.name, text: text.slice(0, 300) };
      room.modelSocket.emit("live:comment", msg);
      for (const v of room.viewers.values()) v.emit("live:comment", msg);
    });

    socket.on("live:gift", guarded(async (giftId) => {
      const room = liveRooms.get(socket.data.watching);
      const cost = GIFTS[giftId];
      if (!room || !cost) return;
      const user = await prisma.user.findUnique({
        where: { id: socket.data.uid },
        select: { coins: true },
      });
      if (!user || user.coins < cost) {
        socket.emit("error:msg", "Not enough coins for that gift.");
        return;
      }
      const creditPaise = cost * GIFT_PAYOUT_PCT; // 30% of ₹value, in paise
      await prisma.$transaction([
        prisma.user.update({
          where: { id: socket.data.uid },
          data: { coins: { decrement: cost } },
        }),
        prisma.modelProfile.update({
          where: { id: room.modelProfileId },
          data: {
            earnings: { increment: creditPaise },
            balance: { increment: creditPaise },
          },
        }),
        prisma.modelEarning.create({
          data: {
            modelProfileId: room.modelProfileId,
            type: "gift",
            amountPaise: creditPaise,
          },
        }),
        prisma.transaction.create({
          data: {
            userId: socket.data.uid,
            type: "GIFT_SPEND",
            coins: -cost,
            meta: `${giftId} (live)`,
          },
        }),
      ]);
      const updated = await prisma.user.findUnique({
        where: { id: socket.data.uid },
        select: { coins: true },
      });
      socket.emit("wallet", { coins: updated?.coins ?? 0 });
      const evt = { giftId, from: socket.data.name };
      room.modelSocket.emit("gift:received", evt);
      for (const v of room.viewers.values()) v.emit("gift:received", evt);
    }));

    socket.on("live:report", guarded(async ({ reason } = {}) => {
      const room = liveRooms.get(socket.data.watching);
      if (!room || typeof reason !== "string" || !reason.trim()) return;
      try {
        await prisma.report.create({
          data: {
            reporterId: socket.data.uid,
            reportedId: room.modelUid,
            reason: String(reason).slice(0, 100),
            detail: "reported during live stream",
          },
        });
        socket.emit("report:ok");
        await reportThreshold(io, room.modelUid);
      } catch (e) {
        console.error("live report error", e);
      }
    }));

    socket.on("disconnect", () => {
      waitingCustomers.delete(socket.data.uid);
      availableModels.delete(socket.data.uid);
      leaveLive(io, socket);
      if (liveRooms.has(socket.data.uid))
        stopLive(io, socket.data.uid, "disconnected");
      const call = activeCalls.get(socket.data.callId);
      if (call) endCall(io, call, "disconnected");
    });
  });

  // watchdog: end any paid call that hasn't billed a minute in STALE_CALL_MS
  // (e.g. a half-dead socket that never fired disconnect)
  setInterval(() => {
    const now = Date.now();
    for (const call of [...activeCalls.values()]) {
      if (!call.isTrial && now - call.lastTickAt > STALE_CALL_MS + BILL_INTERVAL_MS) {
        endCall(io, call, "stale");
      }
    }
  }, 30_000).unref?.();

  server.listen(port, () => {
    console.log(`funwithu.in ready on http://localhost:${port} (${dev ? "dev" : "prod"})`);
  });
});

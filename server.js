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

const COINS_PER_MIN = 6;
const MODEL_EARN_PER_MIN = 3; // ₹ per minute
const TICK_SECONDS = 10; // billing granularity
const COINS_PER_TICK = COINS_PER_MIN / (60 / TICK_SECONDS); // 1 coin / 10s
const GIFTS = { rose: 10, kiss: 25, ring: 60, crown: 150 };
const GIFT_MODEL_SHARE = 0.6;

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
    await prisma.call.update({
      where: { id: call.dbId },
      data: {
        endedAt: new Date(),
        seconds,
        coinsSpent: call.coinsSpent,
        modelEarn: call.modelEarn,
        endReason: reason,
      },
    });
    await prisma.modelProfile.update({
      where: { id: call.modelProfileId },
      data: { totalMinutes: { increment: Math.ceil(seconds / 60) } },
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

  const call = {
    id: callId,
    dbId: dbCall.id,
    room,
    customerSocket,
    modelSocket,
    modelProfileId: modelSocket.data.modelProfileId,
    startedAt: Date.now(),
    coinsSpent: 0,
    modelEarn: 0,
    ticks: 0,
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
    // customer is the WebRTC initiator
    initiator: customerSocket.data.uid,
    coinsPerMin: COINS_PER_MIN,
  });

  // billing tick: debit customer, credit model; stop when the wallet is empty
  call.timer = setInterval(async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: customerSocket.data.uid },
        select: { coins: true },
      });
      if (!user || user.coins < COINS_PER_TICK) {
        await endCall(io, call, "out-of-coins");
        return;
      }
      call.ticks += 1;
      call.coinsSpent += COINS_PER_TICK;
      const earn =
        call.ticks % (60 / TICK_SECONDS) === 0 ? MODEL_EARN_PER_MIN : 0;
      call.modelEarn += earn;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: customerSocket.data.uid },
          data: { coins: { decrement: COINS_PER_TICK } },
        }),
        ...(earn
          ? [
              prisma.modelProfile.update({
                where: { id: call.modelProfileId },
                data: {
                  earnings: { increment: earn },
                  balance: { increment: earn },
                },
              }),
            ]
          : []),
      ]);

      const updated = await prisma.user.findUnique({
        where: { id: customerSocket.data.uid },
        select: { coins: true },
      });
      customerSocket.emit("wallet", { coins: updated?.coins ?? 0 });
      if (earn) modelSocket.emit("earned", { total: call.modelEarn });
    } catch (e) {
      console.error("billing tick error", e);
    }
  }, TICK_SECONDS * 1000);
}

function tryMatch(io) {
  while (waitingCustomers.size > 0 && availableModels.size > 0) {
    const [cid, customerSocket] = waitingCustomers.entries().next().value;
    const [mid, modelSocket] = availableModels.entries().next().value;
    waitingCustomers.delete(cid);
    availableModels.delete(mid);
    if (!customerSocket.connected || !modelSocket.connected) continue;
    startCall(io, customerSocket, modelSocket).catch((e) =>
      console.error("startCall error", e)
    );
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const io = new Server(server, { path: "/rtc" });

  // authenticate sockets from the same JWT cookie the web app uses
  io.use(async (socket, nextFn) => {
    const token = parseCookie(socket.request.headers.cookie, "fwu_token");
    if (!token) return nextFn(new Error("unauthorized"));
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
    socket.data.uid = user.id;
    socket.data.name = user.name;
    socket.data.role = user.role;
    socket.data.modelProfileId = user.modelProfile?.id || null;
    socket.data.modelApproved = user.modelProfile?.status === "APPROVED";
    nextFn();
  });

  io.on("connection", (socket) => {
    // ---- model side ----
    socket.on("model:online", () => {
      if (!socket.data.modelApproved) {
        socket.emit("error:msg", "Your model account is not approved yet.");
        return;
      }
      socket.data.wantsOnline = true;
      availableModels.set(socket.data.uid, socket);
      socket.emit("model:status", { online: true });
      tryMatch(io);
    });

    socket.on("model:offline", () => {
      socket.data.wantsOnline = false;
      availableModels.delete(socket.data.uid);
      socket.emit("model:status", { online: false });
    });

    // ---- customer side ----
    socket.on("find", async () => {
      const user = await prisma.user.findUnique({
        where: { id: socket.data.uid },
        select: { coins: true },
      });
      if (!user || user.coins < COINS_PER_MIN) {
        socket.emit("error:msg", "You need more coins to start a video chat.");
        return;
      }
      waitingCustomers.set(socket.data.uid, socket);
      socket.emit("searching");
      tryMatch(io);
    });

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

    socket.on("chat:msg", (text) => {
      const call = activeCalls.get(socket.data.callId);
      if (!call || typeof text !== "string" || !text.trim()) return;
      io.to(call.room).emit("chat:msg", {
        from: socket.data.name,
        self: socket.id,
        text: text.slice(0, 500),
      });
    });

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
      const modelCut = Math.round(cost * GIFT_MODEL_SHARE);
      call.coinsSpent += cost;
      call.modelEarn += modelCut;
      await prisma.$transaction([
        prisma.user.update({
          where: { id: socket.data.uid },
          data: { coins: { decrement: cost } },
        }),
        prisma.modelProfile.update({
          where: { id: call.modelProfileId },
          data: {
            earnings: { increment: modelCut },
            balance: { increment: modelCut },
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
      io.to(call.room).emit("gift:received", { giftId, from: socket.data.name });
    });

    socket.on("call:end", () => {
      const call = activeCalls.get(socket.data.callId);
      if (call) endCall(io, call, "ended-by-user");
    });

    socket.on("disconnect", () => {
      waitingCustomers.delete(socket.data.uid);
      availableModels.delete(socket.data.uid);
      const call = activeCalls.get(socket.data.callId);
      if (call) endCall(io, call, "disconnected");
    });
  });

  server.listen(port, () => {
    console.log(`funwithu.in ready on http://localhost:${port} (${dev ? "dev" : "prod"})`);
  });
});

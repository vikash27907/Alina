"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import Link from "next/link";
import { GIFTS } from "@/lib/economy";

type Room = { uid: string; name: string; vip: boolean; viewers: number };
type Comment = { from: string; text: string };

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function LiveBrowser({
  loggedIn,
  isPayer,
}: {
  loggedIn: boolean;
  isPayer: boolean;
}) {
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [watching, setWatching] = useState<{ model: string; vip: boolean; count: number } | null>(null);
  const [queued, setQueued] = useState<{ model: string; position: number } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [note, setNote] = useState("");
  const [input, setInput] = useState("");
  const [floats, setFloats] = useState<{ id: number; emoji: string }[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = io({ path: "/rtc" });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("live:list:get"));
    socket.on("live:list", (list: Room[]) => setRooms(list));
    socket.on("live:joined", (d: any) => {
      setQueued(null);
      setWatching(d);
      setComments([]);
      setNote("");
    });
    socket.on("live:queued", (d: any) => {
      cleanup();
      setQueued(d);
      setNote("");
    });
    socket.on("live:error", ({ message }: any) => setNote(message));
    socket.on("error:msg", (m: string) => setNote(m));
    socket.on("mod:warning", ({ message, strikes, max }: any) =>
      setNote(`⚠ ${message} (${strikes}/${max})`)
    );
    socket.on("mod:banned", ({ seconds }: any) =>
      setNote(`⛔ You are timed out for ${seconds >= 3600 ? Math.round(seconds / 3600) + "h" : Math.round(seconds / 60) + " min"} for breaking chat rules.`)
    );
    socket.on("live:ended", ({ reason }: any) => {
      cleanup();
      setQueued(null);
      setNote(reason === "moderation" ? "Stream ended by moderation." : "Stream ended.");
    });
    socket.on("live:kicked", ({ reason, message }: any) => {
      cleanup();
      if (reason === "vip-bump") {
        // server also sends live:queued right after; just show the message
        setNote(message || "A VIP took your spot — you're back in the queue.");
      } else {
        setQueued(null);
        setNote(message || "The model switched to VIP-only. Buy coins to join VIP streams.");
      }
    });
    socket.on("live:comment", (c: Comment) =>
      setComments((p) => [...p.slice(-150), c])
    );
    socket.on("gift:received", ({ giftId, from }: any) => {
      const g = GIFTS.find((x) => x.id === giftId);
      if (!g) return;
      const id = Date.now() + Math.random();
      setFloats((p) => [...p, { id, emoji: g.emoji }]);
      setTimeout(() => setFloats((p) => p.filter((x) => x.id !== id)), 2300);
      setComments((p) => [...p.slice(-150), { from, text: `sent ${g.emoji} ${g.label}` }]);
    });
    socket.on("live:signal", async ({ from, data }: any) => {
      if (data.sdp) {
        const pc = new RTCPeerConnection(ICE);
        pcRef.current?.close();
        pcRef.current = pc;
        pc.ontrack = (e) => {
          if (videoRef.current) videoRef.current.srcObject = e.streams[0];
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit("live:signal", { data: { candidate: e.candidate } });
        };
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("live:signal", { data: { sdp: pc.localDescription } });
      } else if (data.candidate && pcRef.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
      }
    });
    return () => {
      socket.disconnect();
      pcRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [comments]);

  function cleanup() {
    pcRef.current?.close();
    pcRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setWatching(null);
  }

  function join(uid: string) {
    setNote("");
    socketRef.current?.emit("live:join", { model: uid });
  }
  function leave() {
    socketRef.current?.emit("live:leave");
    cleanup();
    setQueued(null);
  }
  function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    socketRef.current?.emit("live:comment", input);
    setInput("");
  }

  if (queued) {
    return (
      <div className="max-w-md mx-auto pt-20 text-center">
        <div className="card p-10">
          <div className="text-5xl mb-4">🔥</div>
          <h1 className="text-2xl font-bold">{queued.model}&apos;s room is full</h1>
          <p className="text-mist mt-3">
            You&apos;re <span className="text-gold font-bold">#{queued.position}</span> in
            the queue — we&apos;ll drop you in the moment a spot frees up.
          </p>
          {!isPayer && (
            <p className="text-gold/80 text-sm mt-4">
              💎 Members with coins skip the queue instantly.
            </p>
          )}
          <div className="flex gap-3 justify-center mt-7">
            {!isPayer && (
              <Link href="/coins" className="btn-exotic">
                Skip the queue
              </Link>
            )}
            <button onClick={leave} className="btn-ghost">
              Leave queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (watching) {
    return (
      <div className="pt-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="font-bold text-lg">
            🔴 {watching.model}{" "}
            {watching.vip && <span className="text-gold text-sm">VIP</span>}
          </p>
          <button onClick={leave} className="btn-ghost !px-4 !py-2">
            ← Back to streams
          </button>
        </div>
        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="relative card overflow-hidden aspect-[4/5] sm:aspect-video bg-ink">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-16 pointer-events-none flex justify-center">
              {floats.map((g) => (
                <span key={g.id} className="gift-float text-5xl absolute">{g.emoji}</span>
              ))}
            </div>
            {loggedIn && (
              <button
                onClick={() => {
                  const r = window.prompt("Why are you reporting this stream?");
                  if (r?.trim()) {
                    socketRef.current?.emit("live:report", { reason: r.trim() });
                    setNote("Report submitted — thank you.");
                  }
                }}
                className="absolute bottom-3 left-3 btn-ghost !px-3 !py-2 !bg-night/80"
                title="Report stream"
              >
                ⚠
              </button>
            )}
          </div>
          <div className="card flex flex-col h-[420px] lg:h-auto">
            <div ref={box} className="flex-1 overflow-y-auto p-4 space-y-2">
              {comments.map((c, i) => (
                <p key={i} className="text-sm">
                  <span className="text-blush font-semibold">{c.from}</span>{" "}
                  <span className="text-mist">{c.text}</span>
                </p>
              ))}
            </div>
            {loggedIn && (
              <div className="px-4 pb-2 flex gap-2 flex-wrap">
                {GIFTS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => socketRef.current?.emit("live:gift", g.id)}
                    className="bg-ink border border-edge rounded-2xl px-3 py-1.5 text-sm hover:border-gold/70"
                    title={`${g.coins} coins`}
                  >
                    {g.emoji} <span className="text-gold text-xs">{g.coins}</span>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={sendComment} className="p-3 border-t border-edge flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!loggedIn}
                className="input-dark !py-2.5"
                placeholder={loggedIn ? "Say something nice…" : "Join free to comment"}
              />
              {loggedIn ? (
                <button className="btn-exotic !px-4 !py-2">➤</button>
              ) : (
                <Link href="/signup" className="btn-exotic !px-4 !py-2 whitespace-nowrap">
                  Join free
                </Link>
              )}
            </form>
          </div>
        </div>
        {note && <div className="mt-4 card border-blush/50 p-4 text-sm">{note}</div>}
      </div>
    );
  }

  return (
    <div className="pt-10">
      <h1 className="text-3xl font-bold">🔴 Live now</h1>
      <p className="text-mist mt-1">
        Watch free. {loggedIn ? "Comment and send gifts while you watch." : "Sign up free to comment."}
      </p>
      {note && <div className="mt-4 card border-blush/50 p-4 text-sm">{note}</div>}
      {rooms.length === 0 ? (
        <div className="card p-12 text-center mt-8">
          <p className="text-4xl mb-3">😴</p>
          <p className="text-mist">No one is live right now — check back soon.</p>
          <Link href={loggedIn ? "/chat" : "/signup"} className="btn-exotic mt-6 inline-flex">
            Try 1-on-1 video chat instead
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {rooms.map((r) => (
            <button
              key={r.uid}
              onClick={() => join(r.uid)}
              className="card p-6 text-left hover:border-blush/60 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs bg-blush/20 text-blush rounded-full px-2.5 py-1">
                  ● LIVE
                </span>
                {r.vip ? (
                  <span className="text-xs text-gold border border-gold/50 rounded-full px-2.5 py-1">👑 VIP</span>
                ) : (
                  <span className="text-xs text-mist">Free</span>
                )}
              </div>
              <p className="font-bold text-lg mt-4">{r.name}</p>
              <p className="text-mist text-sm mt-1">{r.viewers} watching</p>
              {r.vip && !isPayer && (
                <p className="text-gold/80 text-xs mt-2">Buy coins to unlock VIP streams</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

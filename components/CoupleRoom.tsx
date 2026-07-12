"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import Link from "next/link";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const DECKS = [
  { id: "truth_dare", label: "Truth or Dare", emoji: "🎯" },
  { id: "would_you_rather", label: "Would You Rather", emoji: "🤔" },
  { id: "couple_quiz", label: "Get to Know You", emoji: "💬" },
];

type Phase = "idle" | "waiting" | "connected" | "ended";
type Msg = { from: string; self: string; text: string };
type Card = { type?: string; text: string };

export default function CoupleRoom({
  myId,
  myName,
  joinCode,
}: {
  myId: string;
  myName: string;
  joinCode?: string;
}) {
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [code, setCode] = useState("");
  const [partner, setPartner] = useState("");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [game, setGame] = useState<{ name: string; turn: string } | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [copied, setCopied] = useState(false);
  const chatBox = useRef<HTMLDivElement>(null);

  const startMedia = useCallback(async () => {
    if (localStream.current) return localStream.current;
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.current = s;
    if (localVideo.current) localVideo.current.srcObject = s;
    return s;
  }, []);

  const setupPeer = useCallback(async (initiator: boolean) => {
    const socket = socketRef.current!;
    const stream = await startMedia();
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.ontrack = (e) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("room:signal", { candidate: e.candidate });
    };
    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("room:signal", { sdp: pc.localDescription });
    }
  }, [startMedia]);

  useEffect(() => {
    const socket = io({ path: "/rtc" });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (joinCode) socket.emit("room:join", { code: joinCode });
    });
    socket.on("room:created", ({ code, expiresAt }: any) => {
      setCode(code);
      setExpiresAt(expiresAt);
      setPhase("waiting");
    });
    socket.on("room:ready", async ({ partner, initiator, expiresAt }: any) => {
      setPartner(partner);
      setExpiresAt(expiresAt);
      setPhase("connected");
      setNote("");
      await setupPeer(initiator);
    });
    socket.on("room:signal", async (data: any) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (data.sdp.type === "offer") {
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            socket.emit("room:signal", { sdp: pc.localDescription });
          }
        } else if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (e) {
        console.error(e);
      }
    });
    socket.on("room:chat", (m: Msg) => setMessages((p) => [...p.slice(-100), m]));
    socket.on("room:extended", ({ expiresAt, by }: any) => {
      setExpiresAt(expiresAt);
      setNote(`⏱️ ${by} added 30 minutes.`);
    });
    socket.on("room:error", ({ message }: any) => setNote(message));
    socket.on("mod:warning", ({ message }: any) => setNote(`⚠ ${message}`));
    socket.on("mod:banned", ({ seconds }: any) =>
      setNote(`⛔ Timed out ${Math.round(seconds / 60)} min for breaking the rules.`)
    );
    socket.on("room:ended", ({ reason }: any) => {
      cleanup();
      setPhase("ended");
      setNote(
        reason === "expired"
          ? "Time's up — the room has closed."
          : reason === "disconnected"
            ? "Your partner left the room."
            : "The room has closed."
      );
    });
    socket.on("game:started", ({ name, turn }: any) => {
      setGame({ name, turn });
      setCard(null);
    });
    socket.on("game:card", ({ card, whoseTurn }: any) => {
      setCard(card);
      setGame((g) => (g ? { ...g, turn: whoseTurn } : g));
    });
    socket.on("game:stopped", () => {
      setGame(null);
      setCard(null);
    });

    return () => {
      socket.disconnect();
      pcRef.current?.close();
      localStream.current?.getTracks().forEach((t) => t.stop());
      localStream.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => {
      setRemaining(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    chatBox.current?.scrollTo({ top: chatBox.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function cleanup() {
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  }

  function createRoom() {
    setNote("");
    socketRef.current?.emit("room:create");
  }
  function shareLink() {
    const url = `${location.origin}/room/${code}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.emit("room:chat", chatInput);
    setChatInput("");
  }
  function leave() {
    socketRef.current?.emit("room:leave");
    cleanup();
    setPhase("ended");
    setNote("You left the room.");
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const myTurn = game?.turn === myId;

  // ---- create / waiting / ended screens ----
  if (phase === "idle" && !joinCode) {
    return (
      <div className="max-w-md mx-auto pt-16 text-center">
        <div className="card p-10">
          <div className="text-5xl mb-4">💞</div>
          <h1 className="text-2xl font-bold">Private couple room</h1>
          <p className="text-mist mt-3">
            Create a private room and share the link with one person. Just the two
            of you — video, chat and games. First room each day is free.
          </p>
          <button onClick={createRoom} className="btn-exotic mt-7 w-full">
            Create my room
          </button>
        </div>
      </div>
    );
  }
  if (phase === "waiting") {
    return (
      <div className="max-w-md mx-auto pt-16 text-center">
        <div className="card p-10">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold">Room ready — invite your partner</h1>
          <p className="text-mist mt-3">Share this link. The room locks when they join.</p>
          <div className="bg-ink border border-edge rounded-2xl px-4 py-3 mt-5 font-mono text-lg tracking-widest">
            {code}
          </div>
          <button onClick={shareLink} className="btn-exotic mt-4 w-full">
            {copied ? "✓ Link copied!" : "Copy invite link"}
          </button>
          <p className="text-mist/60 text-sm mt-4">Waiting for your partner to join…</p>
          {note && <p className="text-blush text-sm mt-3">{note}</p>}
        </div>
      </div>
    );
  }
  if (phase === "idle" && joinCode) {
    return (
      <div className="max-w-md mx-auto pt-24 text-center">
        <div className="card p-10">
          <div className="text-4xl mb-4">💞</div>
          <p className="text-mist">Joining room {joinCode}…</p>
          {note && <p className="text-blush text-sm mt-4">{note}</p>}
        </div>
      </div>
    );
  }
  if (phase === "ended") {
    return (
      <div className="max-w-md mx-auto pt-24 text-center">
        <div className="card p-10">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-2xl font-bold">Room closed</h1>
          <p className="text-mist mt-3">{note}</p>
          <Link href="/room" className="btn-exotic mt-7 inline-flex">
            New room
          </Link>
        </div>
      </div>
    );
  }

  // ---- connected room ----
  const lowTime = remaining > 0 && remaining <= 120;
  return (
    <div className="pt-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="font-bold">💞 With {partner}</p>
        <div className="flex items-center gap-2">
          <span className={`text-sm rounded-2xl px-3 py-1.5 border ${lowTime ? "border-blush text-blush" : "border-edge text-mist"}`}>
            ⏱️ {mmss(remaining)}
          </span>
          <button onClick={() => socketRef.current?.emit("room:extend")} className="btn-ghost !px-3 !py-1.5 text-sm">
            +30 min · 10 coins
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="relative card overflow-hidden aspect-[4/5] sm:aspect-video bg-ink">
          <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-cover" />
          <video ref={localVideo} autoPlay playsInline muted className="absolute bottom-3 right-3 w-28 sm:w-40 aspect-video object-cover rounded-2xl border border-edge bg-night" />

          {/* game card overlay */}
          {card && (
            <div className="absolute inset-x-4 top-4 bg-night/90 border border-violet/50 rounded-2xl p-4 text-center shadow-glow-violet">
              {card.type && <p className="text-xs uppercase tracking-widest text-gold mb-1">{card.type}</p>}
              <p className="text-lg font-semibold">{card.text}</p>
            </div>
          )}

          <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap">
            <button onClick={leave} className="btn-ghost !px-4 !py-2 !bg-night/80">✕ Leave</button>
            <button
              onClick={() => {
                const r = window.prompt("Why are you reporting your partner?");
                if (r?.trim()) { socketRef.current?.emit("room:report", { reason: r.trim() }); setNote("Report submitted."); }
              }}
              className="btn-ghost !px-3 !py-2 !bg-night/80"
              title="Report"
            >⚠</button>
          </div>
        </div>

        <div className="card flex flex-col h-[440px] lg:h-auto">
          {/* games */}
          <div className="p-3 border-b border-edge">
            {!game ? (
              <div className="flex gap-2 flex-wrap">
                {DECKS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => socketRef.current?.emit("game:start", { deck: d.id })}
                    className="bg-ink border border-edge rounded-2xl px-3 py-1.5 text-sm hover:border-violet/60"
                  >
                    {d.emoji} {d.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  {myTurn ? "🎲 Your turn" : `Waiting for ${partner}`}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => socketRef.current?.emit("game:draw")}
                    disabled={!myTurn}
                    className="btn-exotic !px-3 !py-1.5 text-sm"
                  >
                    Draw card
                  </button>
                  <button onClick={() => socketRef.current?.emit("game:stop")} className="btn-ghost !px-3 !py-1.5 text-sm">
                    Stop
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* chat */}
          <div ref={chatBox} className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 && <p className="text-mist/50 text-sm text-center mt-6">Say hi 💬</p>}
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.self === (socketRef.current?.id ?? "") ? "bg-exotic text-white ml-auto" : "bg-ink border border-edge"}`}>
                <span className="block text-[11px] opacity-60">{m.from}</span>
                {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={sendChat} className="p-3 border-t border-edge flex gap-2">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} className="input-dark !py-2.5" placeholder="Message…" />
            <button className="btn-exotic !px-4 !py-2">➤</button>
          </form>
        </div>
      </div>

      {note && <div className="mt-4 card border-violet/40 p-3 text-sm">{note}</div>}
    </div>
  );
}

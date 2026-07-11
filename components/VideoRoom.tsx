"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import Link from "next/link";
import { GIFTS } from "@/lib/economy";

type Props = {
  role: "customer" | "model";
  initialCoins?: number;
};

type ChatMsg = { from: string; self: string; text: string };
type FloatingGift = { id: number; emoji: string };

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function VideoRoom({ role, initialCoins = 0 }: Props) {
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const myIdRef = useRef<string>("");

  const [phase, setPhase] = useState<
    "idle" | "searching" | "online" | "connected"
  >("idle");
  const [partner, setPartner] = useState("");
  const [coins, setCoins] = useState(initialCoins);
  const [earned, setEarned] = useState(0);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [note, setNote] = useState("");
  const [gifts, setGifts] = useState<FloatingGift[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatBox = useRef<HTMLDivElement>(null);

  const cleanupCall = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    setPartner("");
    setMessages([]);
  }, []);

  const startMedia = useCallback(async () => {
    if (localStream.current) return localStream.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    localStream.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    return stream;
  }, []);

  useEffect(() => {
    const socket = io({ path: "/rtc" });
    socketRef.current = socket;

    socket.on("connect", () => {
      myIdRef.current = socket.id ?? "";
    });

    socket.on("searching", () => setPhase("searching"));
    socket.on("search:cancelled", () => setPhase("idle"));
    socket.on("model:status", ({ online }: { online: boolean }) =>
      setPhase(online ? "online" : "idle")
    );
    socket.on("error:msg", (msg: string) => setNote(msg));
    socket.on("mod:warning", ({ message, strikes, max }: any) =>
      setNote(`⚠ ${message} (warning ${strikes}/${max})`)
    );
    socket.on("mod:banned", ({ seconds }: any) =>
      setNote(
        `⛔ You are timed out for ${
          seconds >= 3600 ? Math.round(seconds / 3600) + " hour(s)" : Math.round(seconds / 60) + " minute(s)"
        } for breaking the content rules.`
      )
    );
    socket.on("wallet", ({ coins }: { coins: number }) => setCoins(coins));
    socket.on("earned", ({ total }: { total: number }) => setEarned(total));

    socket.on(
      "matched",
      async ({ initiator, customer, model }: any) => {
        setNote("");
        setPhase("connected");
        setPartner(role === "customer" ? model.name : customer.name);

        const stream = await startMedia();
        const pc = new RTCPeerConnection(ICE);
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.ontrack = (e) => {
          if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit("signal", { candidate: e.candidate });
        };

        // the server tells us which side creates the offer
        const amInitiator = role === "customer";
        if (amInitiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("signal", { sdp: pc.localDescription });
        }
      }
    );

    socket.on("signal", async (data: any) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (data.sdp.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketRef.current?.emit("signal", { sdp: pc.localDescription });
          }
        } else if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (e) {
        console.error("signal error", e);
      }
    });

    socket.on("chat:msg", (m: ChatMsg) => {
      setMessages((prev) => [...prev.slice(-100), m]);
    });

    socket.on("gift:received", ({ giftId }: { giftId: string }) => {
      const g = GIFTS.find((x) => x.id === giftId);
      if (!g) return;
      const id = Date.now() + Math.random();
      setGifts((prev) => [...prev, { id, emoji: g.emoji }]);
      setTimeout(() => setGifts((prev) => prev.filter((x) => x.id !== id)), 2300);
    });

    socket.on("call:ended", ({ reason }: { reason: string }) => {
      cleanupCall();
      if (role === "model") {
        setPhase("online");
      } else {
        setPhase("idle");
        if (reason === "out-of-coins")
          setNote("You ran out of coins — top up to keep chatting.");
        else if (reason === "disconnected")
          setNote("Your partner disconnected.");
      }
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
    chatBox.current?.scrollTo({ top: chatBox.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function begin() {
    setNote("");
    try {
      await startMedia();
    } catch {
      setNote("Camera/mic permission is needed for video chat.");
      return;
    }
    if (role === "customer") socketRef.current?.emit("find");
    else socketRef.current?.emit("model:online");
  }

  function stop() {
    if (phase === "connected") socketRef.current?.emit("call:end");
    if (role === "customer") socketRef.current?.emit("find:cancel");
    else socketRef.current?.emit("model:offline");
    cleanupCall();
    setPhase("idle");
  }

  function nextPartner() {
    socketRef.current?.emit("call:end");
    cleanupCall();
    socketRef.current?.emit("find");
  }

  function reportPartner() {
    const reason = window.prompt(
      "Why are you reporting this person?\n(e.g. abusive behaviour, inappropriate content, scam)"
    );
    if (!reason?.trim()) return;
    socketRef.current?.emit("report", { reason: reason.trim() });
    setNote("Report submitted — our team will review it. Thank you.");
  }

  function blockPartner() {
    if (!window.confirm("Block this person? You will never be matched with them again.")) return;
    socketRef.current?.emit("block:partner");
    setNote("Blocked. You won't be paired with them again.");
  }

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.emit("chat:msg", chatInput);
    setChatInput("");
  }

  const inCall = phase === "connected";

  return (
    <div className="pt-6">
      {/* status bar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-mist">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              inCall
                ? "bg-green-400"
                : phase === "searching" || phase === "online"
                  ? "bg-gold"
                  : "bg-mist/40"
            }`}
          />
          {inCall
            ? `Live with ${partner}`
            : phase === "searching"
              ? "Finding someone for you…"
              : phase === "online"
                ? "You are online — waiting for a match"
                : "Ready when you are"}
        </div>
        {role === "customer" ? (
          <Link
            href="/coins"
            className="flex items-center gap-1.5 bg-surface border border-edge rounded-2xl px-3 py-1.5 text-sm hover:border-gold/60"
          >
            <span className="text-gold">●</span>
            <span className="font-semibold">{coins}</span>
            <span className="text-mist">coins</span>
          </Link>
        ) : (
          <div className="flex items-center gap-1.5 bg-surface border border-edge rounded-2xl px-3 py-1.5 text-sm">
            <span className="text-gold">₹</span>
            <span className="font-semibold">{earned}</span>
            <span className="text-mist">this call</span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* video stage */}
        <div className="relative card overflow-hidden aspect-[4/5] sm:aspect-video bg-ink">
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${inCall ? "" : "hidden"}`}
          />

          {!inCall && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
              {phase === "searching" || phase === "online" ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-exotic searching-pulse flex items-center justify-center text-3xl">
                    {role === "customer" ? "🔎" : "🟢"}
                  </div>
                  <p className="text-mist">
                    {role === "customer"
                      ? "Matching you with a verified model…"
                      : "Online — customers will connect automatically."}
                  </p>
                  <button onClick={stop} className="btn-ghost">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div className="text-5xl">🎥</div>
                  <p className="text-mist max-w-xs">
                    {role === "customer"
                      ? "Tap below to be paired instantly on live video."
                      : "Go online to start receiving video calls and earning."}
                  </p>
                  <button onClick={begin} className="btn-exotic text-lg !px-10 !py-4">
                    {role === "customer" ? "▶ Find someone" : "🟢 Go online"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* self preview */}
          <video
            ref={localVideo}
            autoPlay
            playsInline
            muted
            className="absolute bottom-3 right-3 w-28 sm:w-40 aspect-video object-cover rounded-2xl border border-edge shadow-soft bg-night"
          />

          {/* floating gifts */}
          <div className="absolute inset-x-0 bottom-16 pointer-events-none flex justify-center">
            {gifts.map((g) => (
              <span key={g.id} className="gift-float text-5xl absolute">
                {g.emoji}
              </span>
            ))}
          </div>

          {/* in-call controls */}
          {inCall && (
            <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap">
              <button onClick={stop} className="btn-ghost !px-4 !py-2 !bg-night/80">
                ✕ End
              </button>
              {role === "customer" && (
                <button onClick={nextPartner} className="btn-exotic !px-4 !py-2">
                  ⏭ Next
                </button>
              )}
              <button
                onClick={reportPartner}
                title="Report this person"
                className="btn-ghost !px-3 !py-2 !bg-night/80"
              >
                ⚠
              </button>
              <button
                onClick={blockPartner}
                title="Block this person"
                className="btn-ghost !px-3 !py-2 !bg-night/80"
              >
                🚫
              </button>
            </div>
          )}
        </div>

        {/* side panel: chat + gifts */}
        <div className="card flex flex-col h-[420px] lg:h-auto">
          <div ref={chatBox} className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 && (
              <p className="text-mist/50 text-sm text-center mt-8">
                Messages appear here 💬
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.self === (socketRef.current?.id ?? "") || m.from === "You"
                    ? "bg-exotic text-white ml-auto"
                    : "bg-ink border border-edge"
                }`}
              >
                <span className="block text-[11px] opacity-60">{m.from}</span>
                {m.text}
              </div>
            ))}
          </div>

          {role === "customer" && inCall && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap">
              {GIFTS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => socketRef.current?.emit("gift:send", g.id)}
                  className="bg-ink border border-edge rounded-2xl px-3 py-1.5 text-sm hover:border-gold/70"
                  title={`${g.coins} coins`}
                >
                  {g.emoji} <span className="text-gold text-xs">{g.coins}</span>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={sendChat} className="p-3 border-t border-edge flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={!inCall}
              className="input-dark !py-2.5"
              placeholder={inCall ? "Say something nice…" : "Chat unlocks in a call"}
            />
            <button disabled={!inCall} className="btn-exotic !px-4 !py-2">
              ➤
            </button>
          </form>
        </div>
      </div>

      {note && (
        <div className="mt-4 card border-blush/50 p-4 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>{note}</span>
          {note.includes("coins") && role === "customer" && (
            <Link href="/coins" className="btn-exotic !px-4 !py-2">
              Get coins
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

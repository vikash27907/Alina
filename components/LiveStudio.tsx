"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import Link from "next/link";
import { GIFTS } from "@/lib/economy";

type Comment = { from: string; text: string };

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function LiveStudio() {
  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const [vip, setVip] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [note, setNote] = useState("");
  const [input, setInput] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = io({ path: "/rtc" });
    socketRef.current = socket;

    socket.on("live:started", ({ vip }: any) => {
      setLive(true);
      setVip(vip);
      setNote("");
    });
    socket.on("live:vip:set", ({ vip }: any) => setVip(vip));
    socket.on("live:viewers", ({ count }: any) => setViewers(count));
    socket.on("error:msg", (m: string) => setNote(m));
    socket.on("mod:warning", ({ message, strikes, max }: any) =>
      setNote(`⚠ ${message} (${strikes}/${max})`)
    );
    socket.on("mod:banned", ({ seconds }: any) => {
      setNote(`⛔ Timed out ${Math.round(seconds / 60)} min for breaking content rules.`);
      endAll();
      setLive(false);
    });
    socket.on("live:ended", ({ reason }: any) => {
      endAll();
      setLive(false);
      if (reason === "moderation")
        setNote("Your stream was ended by moderation. Check Support for details.");
    });
    socket.on("live:comment", (c: Comment) =>
      setComments((p) => [...p.slice(-150), c])
    );
    socket.on("gift:received", ({ giftId, from }: any) => {
      const g = GIFTS.find((x) => x.id === giftId);
      if (g) setComments((p) => [...p.slice(-150), { from, text: `sent ${g.emoji} ${g.label}!` }]);
    });

    // a viewer joined — open a peer connection and send them an offer
    socket.on("live:viewer", async ({ sid, count }: any) => {
      setViewers(count);
      const stream = streamRef.current;
      if (!stream) return;
      const pc = new RTCPeerConnection(ICE);
      pcs.current.set(sid, pc);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate)
          socket.emit("live:signal", { to: sid, data: { candidate: e.candidate } });
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("live:signal", { to: sid, data: { sdp: pc.localDescription } });
    });

    socket.on("live:viewer-left", ({ sid, count }: any) => {
      setViewers(count);
      pcs.current.get(sid)?.close();
      pcs.current.delete(sid);
    });

    socket.on("live:signal", async ({ from, data }: any) => {
      const pc = pcs.current.get(from);
      if (!pc) return;
      try {
        if (data.sdp) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        else if (data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.error(e);
      }
    });

    return () => {
      socket.disconnect();
      endAll();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [comments]);

  function endAll() {
    pcs.current.forEach((pc) => pc.close());
    pcs.current.clear();
    setViewers(0);
  }

  async function goLive(asVip: boolean) {
    setNote("");
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (videoRef.current) videoRef.current.srcObject = streamRef.current;
      }
    } catch {
      setNote("Camera/mic permission is needed to go live.");
      return;
    }
    socketRef.current?.emit("live:start", { vip: asVip });
  }

  function stop() {
    socketRef.current?.emit("live:stop");
    endAll();
    setLive(false);
  }

  function toggleVip() {
    socketRef.current?.emit("live:vip", { vip: !vip });
  }

  function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    socketRef.current?.emit("live:comment", input);
    setInput("");
  }

  return (
    <div className="pt-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Live studio</h1>
          <p className="text-mist text-sm">
            Broadcast to everyone — or flip to VIP so only paying members can watch.
          </p>
        </div>
        <Link href="/model/dashboard" className="btn-ghost !px-4 !py-2">
          ← Dashboard
        </Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="relative card overflow-hidden aspect-[4/5] sm:aspect-video bg-ink">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!live && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-night/60">
              <div className="text-5xl">📡</div>
              <p className="text-mist max-w-xs">
                Going live lists you on the Live page instantly. Keep it fun and
                within the Community Guidelines.
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <button onClick={() => goLive(false)} className="btn-exotic !px-8 !py-3.5">
                  🔴 Go live (free)
                </button>
                <button onClick={() => goLive(true)} className="btn-ghost !px-8 !py-3.5 !text-gold">
                  👑 Go live (VIP only)
                </button>
              </div>
            </div>
          )}
          {live && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs bg-blush/90 text-white rounded-full px-3 py-1.5 font-semibold">
                  ● LIVE
                </span>
                {vip && (
                  <span className="text-xs bg-night/80 text-gold border border-gold/50 rounded-full px-3 py-1.5">
                    👑 VIP only
                  </span>
                )}
                <span className="text-xs bg-night/80 text-white rounded-full px-3 py-1.5">
                  👀 {viewers}
                </span>
              </div>
              <div className="absolute bottom-3 left-3 flex gap-2">
                <button onClick={stop} className="btn-ghost !px-4 !py-2 !bg-night/80">
                  ⏹ End stream
                </button>
                <button
                  onClick={toggleVip}
                  className={`!px-4 !py-2 ${vip ? "btn-exotic" : "btn-ghost !bg-night/80 !text-gold"}`}
                >
                  {vip ? "Open to everyone" : "👑 Switch to VIP"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="card flex flex-col h-[420px] lg:h-auto">
          <div ref={box} className="flex-1 overflow-y-auto p-4 space-y-2">
            {comments.length === 0 && (
              <p className="text-mist/50 text-sm text-center mt-8">
                Viewer comments appear here 💬
              </p>
            )}
            {comments.map((c, i) => (
              <p key={i} className="text-sm">
                <span className="text-blush font-semibold">{c.from}</span>{" "}
                <span className="text-mist">{c.text}</span>
              </p>
            ))}
          </div>
          <form onSubmit={sendComment} className="p-3 border-t border-edge flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!live}
              className="input-dark !py-2.5"
              placeholder={live ? "Reply to your viewers…" : "Chat unlocks when live"}
            />
            <button disabled={!live} className="btn-exotic !px-4 !py-2">➤</button>
          </form>
        </div>
      </div>

      {note && <div className="mt-4 card border-blush/50 p-4 text-sm">{note}</div>}
    </div>
  );
}

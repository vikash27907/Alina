"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  hint: string;
  facing: "user" | "environment";
  value: string | null;
  onChange: (dataUrl: string | null) => void;
};

// Live camera capture with an optional upload fallback. Produces a JPEG data URL.
export default function CameraField({ label, hint, facing, value, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true);
      // wait a tick for the video element to mount
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch {
      setErr("Camera not available. Allow camera access, or upload a photo instead.");
    }
  }

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onChange(dataUrl);
    stopStream();
    setLive(false);
  }

  function retake() {
    onChange(null);
    openCamera();
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Image must be under 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="label">{label}</label>
      <p className="text-mist/70 text-xs mb-2">{hint}</p>

      <div className="rounded-2xl border border-edge bg-ink overflow-hidden">
        {value ? (
          // captured / uploaded preview
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt={label} className="w-full aspect-video object-cover" />
            <span className="absolute top-2 left-2 text-xs bg-green-500/90 text-white rounded-full px-2.5 py-1">
              ✓ Captured
            </span>
          </div>
        ) : live ? (
          // live camera preview
          <div className="relative">
            <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover" />
            <div className="absolute inset-x-0 bottom-0 p-3 flex justify-center bg-gradient-to-t from-black/70">
              <button type="button" onClick={capture} className="btn-exotic !px-8 !py-2.5">
                📸 Capture
              </button>
            </div>
          </div>
        ) : (
          <div className="aspect-video flex flex-col items-center justify-center gap-3 p-4 text-center">
            <span className="text-3xl">{facing === "user" ? "🤳" : "🪪"}</span>
            <button type="button" onClick={openCamera} className="btn-exotic !px-6 !py-2.5">
              Open camera
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        {value ? (
          <button type="button" onClick={retake} className="text-blush text-sm hover:underline">
            ↻ Retake
          </button>
        ) : (
          <label className="text-mist text-sm hover:text-white cursor-pointer">
            or upload a photo
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </label>
        )}
      </div>
      {err && <p className="text-blush text-xs mt-1">{err}</p>}
    </div>
  );
}

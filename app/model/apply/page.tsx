"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CameraField from "@/components/CameraField";

export default function ModelApply() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // step 1 fields
  const [fields, setFields] = useState({
    name: "",
    email: "",
    password: "",
    dob: "",
    country: "",
    languages: "",
  });
  const [adult, setAdult] = useState(false);
  const [idDoc, setIdDoc] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  function goToStep2() {
    setError("");
    const { name, email, password, dob, country, languages } = fields;
    if (!name || !email || !password || !dob || !country || !languages) {
      setError("Please fill in all the details first.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setStep(2);
  }

  async function submit() {
    setError("");
    if (!idDoc) return setError("Please capture or upload your government ID.");
    if (!selfie) return setError("Please capture your live selfie holding the ID.");
    if (!adult) return setError("Please confirm you are 18+ and accept the terms.");

    setBusy(true);
    try {
      const res = await fetch("/api/model/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, adult, idDoc, selfie }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Submission failed (error ${res.status}). Please try again.`);
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — please check your connection and try again.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto pt-20 text-center">
        <div className="card p-10">
          <div className="text-6xl mb-5">🎉</div>
          <h1 className="text-2xl font-bold">Application submitted!</h1>
          <p className="text-mist mt-3">
            Thanks, {fields.name.split(" ")[0]}. Our team will verify your
            documents — this usually takes a few hours. You&apos;ll be able to go
            online and start earning as soon as you&apos;re approved.
          </p>
          <button
            onClick={() => {
              router.push("/model/dashboard");
              router.refresh();
            }}
            className="btn-exotic mt-7"
          >
            Go to my dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pt-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">
          Become a <span className="text-transparent bg-clip-text bg-exotic">model</span>
        </h1>
        <p className="text-mist mt-2">
          Earn per minute of video chat + 60% of every gift. Paid weekly.
        </p>
      </div>

      <div className="card p-8">
        <div className="flex gap-2 mb-7">
          {[1, 2].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-exotic" : "bg-edge"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">Name</label>
              <input value={fields.name} onChange={set("name")} maxLength={40} className="input-dark" placeholder="Your display name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={fields.email} onChange={set("email")} type="email" className="input-dark" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input value={fields.password} onChange={set("password")} type="password" className="input-dark" placeholder="8+ characters" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date of birth</label>
                <input value={fields.dob} onChange={set("dob")} type="date" className="input-dark" />
              </div>
              <div>
                <label className="label">Country</label>
                <input value={fields.country} onChange={set("country")} className="input-dark" placeholder="India" />
              </div>
            </div>
            <div>
              <label className="label">Languages you speak</label>
              <input value={fields.languages} onChange={set("languages")} className="input-dark" placeholder="Hindi, English" />
            </div>
            {error && <p className="text-blush text-sm">{error}</p>}
            <button type="button" onClick={goToStep2} className="btn-exotic w-full">
              Continue → Verification
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-exotic-soft border border-edge rounded-2xl p-4 text-sm text-mist">
              🔒 Take <strong className="text-white">live photos</strong> from your camera — this proves
              you&apos;re a real person and keeps fakes off the platform. Your
              documents are reviewed privately and never shown to anyone else.
            </div>

            <CameraField
              label="Government ID"
              hint="Hold your passport / Aadhaar / driving licence up to the camera so the details are readable."
              facing="environment"
              value={idDoc}
              onChange={setIdDoc}
            />

            <CameraField
              label="Live selfie holding your ID"
              hint="Take a selfie with your face and the same ID both clearly visible."
              facing="user"
              value={selfie}
              onChange={setSelfie}
            />

            <label className="flex items-start gap-3 text-sm text-mist cursor-pointer">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1 accent-pink-500" />
              <span>
                I confirm I am 18+, these documents are mine, and I accept the{" "}
                <a href="/legal/creator-agreement" target="_blank" className="text-blush hover:underline">Creator Agreement</a>,{" "}
                <a href="/legal/terms" target="_blank" className="text-blush hover:underline">Terms of Service</a> and{" "}
                <a href="/legal/community-guidelines" target="_blank" className="text-blush hover:underline">Community Guidelines</a>.
              </span>
            </label>

            {error && <p className="text-blush text-sm">{error}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => { setStep(1); setError(""); }} className="btn-ghost flex-1">
                ← Back
              </button>
              <button type="button" onClick={submit} disabled={busy} className="btn-exotic flex-1">
                {busy ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-mist text-sm mt-5 text-center">
        Already applied?{" "}
        <Link href="/login" className="text-blush hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

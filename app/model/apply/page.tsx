"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ModelApply() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/model/apply", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setBusy(false);
      return;
    }
    router.push("/model/dashboard");
    router.refresh();
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
        {/* steps indicator */}
        <div className="flex gap-2 mb-7">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-exotic" : "bg-edge"}`}
            />
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className={step === 1 ? "space-y-4" : "hidden"}>
            <div>
              <label className="label">Name</label>
              <input name="name" required maxLength={40} className="input-dark" placeholder="Your display name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" required className="input-dark" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input name="password" type="password" required minLength={8} className="input-dark" placeholder="8+ characters" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date of birth</label>
                <input name="dob" type="date" required className="input-dark" />
              </div>
              <div>
                <label className="label">Country</label>
                <input name="country" required className="input-dark" placeholder="India" />
              </div>
            </div>
            <div>
              <label className="label">Languages you speak</label>
              <input name="languages" required className="input-dark" placeholder="Hindi, English" />
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="btn-exotic w-full"
            >
              Continue → Verification
            </button>
          </div>

          <div className={step === 2 ? "space-y-4" : "hidden"}>
            <div className="bg-exotic-soft border border-edge rounded-2xl p-4 text-sm text-mist">
              🔒 Verification keeps the platform safe and is required by law.
              Your documents are reviewed privately by our team and never shown
              to anyone else.
            </div>
            <div>
              <label className="label">Government ID (photo of passport / Aadhaar / driving licence)</label>
              <input name="idDoc" type="file" accept="image/*" required className="input-dark file:mr-3 file:btn-ghost file:!py-1.5 file:!px-3 file:border-0 file:text-sm" />
            </div>
            <div>
              <label className="label">Selfie holding your ID next to your face</label>
              <input name="selfie" type="file" accept="image/*" required className="input-dark file:mr-3 file:btn-ghost file:!py-1.5 file:!px-3 file:border-0 file:text-sm" />
            </div>
            <label className="flex items-start gap-3 text-sm text-mist cursor-pointer">
              <input type="checkbox" name="adult" required className="mt-1 accent-pink-500" />
              <span>
                I confirm I am 18+, these documents are mine, and I accept the{" "}
                <a href="/legal/creator-agreement" target="_blank" className="text-blush hover:underline">Creator Agreement</a>,{" "}
                <a href="/legal/terms" target="_blank" className="text-blush hover:underline">Terms of Service</a> and{" "}
                <a href="/legal/community-guidelines" target="_blank" className="text-blush hover:underline">Community Guidelines</a>.
              </span>
            </label>
            {error && <p className="text-blush text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="btn-ghost flex-1">
                ← Back
              </button>
              <button disabled={busy} className="btn-exotic flex-1">
                {busy ? "Submitting…" : "Submit application"}
              </button>
            </div>
          </div>
        </form>
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

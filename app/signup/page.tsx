"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Signup() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        adult: form.get("adult") === "on",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setBusy(false);
      return;
    }
    router.push("/chat");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto pt-16">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">Join FunWithU</h1>
        <p className="text-mist text-sm mt-1">30 free coins are waiting for you.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="label">Your name</label>
            <input name="name" required maxLength={40} className="input-dark" placeholder="What should we call you?" />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" required className="input-dark" placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" required minLength={8} className="input-dark" placeholder="8+ characters" />
          </div>
          <label className="flex items-start gap-3 text-sm text-mist cursor-pointer">
            <input type="checkbox" name="adult" required className="mt-1 accent-pink-500" />
            I confirm I am 18 years or older and accept the terms.
          </label>
          {error && <p className="text-blush text-sm">{error}</p>}
          <button disabled={busy} className="btn-exotic w-full">
            {busy ? "Creating account…" : "Create free account"}
          </button>
        </form>
        <p className="text-mist text-sm mt-5 text-center">
          Already a member?{" "}
          <Link href="/login" className="text-blush hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

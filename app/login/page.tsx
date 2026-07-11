"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Login failed");
      setBusy(false);
      return;
    }
    router.push(data.redirect || "/chat");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto pt-16">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-mist text-sm mt-1">Log in to continue.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" required className="input-dark" placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" required className="input-dark" placeholder="Your password" />
          </div>
          {error && <p className="text-blush text-sm">{error}</p>}
          <button disabled={busy} className="btn-exotic w-full">
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="text-mist text-sm mt-5 text-center">
          New here?{" "}
          <Link href="/signup" className="text-blush hover:underline">
            Join free
          </Link>
        </p>
      </div>
    </div>
  );
}

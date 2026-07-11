"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PayoutForm({
  balance,
  minPayout,
}: {
  balance: number;
  minPayout: number;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/model/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(form.get("amount")),
        method: form.get("method"),
        details: form.get("details"),
      }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? "Payout requested ✓" : data.error || "Failed");
    if (res.ok) router.refresh();
  }

  return (
    <div className="card p-6">
      <h3 className="font-bold mb-1">Withdraw earnings</h3>
      <p className="text-mist text-xs mb-4">
        Minimum ₹{minPayout}. Processed within 7 days.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          name="amount"
          type="number"
          min={minPayout}
          max={balance}
          required
          className="input-dark"
          placeholder={`Amount (max ₹${balance})`}
        />
        <select name="method" required className="input-dark">
          <option value="UPI">UPI</option>
          <option value="BANK">Bank transfer</option>
          <option value="PAYPAL">PayPal</option>
          <option value="CRYPTO">Crypto (USDT)</option>
        </select>
        <input
          name="details"
          required
          className="input-dark"
          placeholder="UPI ID / account details"
        />
        {msg && <p className="text-sm text-gold">{msg}</p>}
        <button disabled={busy || balance < minPayout} className="btn-exotic w-full">
          {busy ? "Requesting…" : "Request payout"}
        </button>
      </form>
    </div>
  );
}

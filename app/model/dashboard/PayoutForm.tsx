"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PayoutForm({
  balancePaise,
  minPayoutPaise,
}: {
  balancePaise: number;
  minPayoutPaise: number;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const balanceRupees = balancePaise / 100;
  const minRupees = minPayoutPaise / 100;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/model/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountRupees: Number(form.get("amount")),
          method: form.get("method"),
          details: form.get("details"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      setMsg(res.ok ? "Payout requested ✓" : data.error || "Failed");
      if (res.ok) router.refresh();
    } catch {
      setBusy(false);
      setMsg("Network error — please try again.");
    }
  }

  return (
    <div className="card p-6">
      <h3 className="font-bold mb-1">Withdraw earnings</h3>
      <p className="text-mist text-xs mb-4">
        Minimum ₹{minRupees}. Processed within 7 days. Balance: ₹{balanceRupees.toFixed(2)}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          name="amount"
          type="number"
          min={minRupees}
          max={Math.floor(balanceRupees)}
          step="1"
          required
          className="input-dark"
          placeholder={`Amount in ₹ (max ₹${Math.floor(balanceRupees)})`}
        />
        <select name="method" required className="input-dark">
          <option value="UPI">UPI</option>
          <option value="BANK">Bank transfer</option>
        </select>
        <input
          name="details"
          required
          className="input-dark"
          placeholder="UPI ID / bank account details"
        />
        {msg && <p className="text-sm text-gold">{msg}</p>}
        <button disabled={busy || balancePaise < minPayoutPaise} className="btn-exotic w-full">
          {busy ? "Requesting…" : "Request payout"}
        </button>
      </form>
    </div>
  );
}

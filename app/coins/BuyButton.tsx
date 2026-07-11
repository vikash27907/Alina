"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BuyButton({ packageId }: { packageId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function buy() {
    setBusy(true);
    const res = await fetch("/api/coins/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
      setTimeout(() => setDone(false), 2000);
    }
  }

  return (
    <button onClick={buy} disabled={busy} className="btn-exotic w-full mt-5">
      {done ? "✓ Added!" : busy ? "Processing…" : "Buy now"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminActions({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "reject") {
    const reason =
      action === "reject" ? prompt("Reason for rejection?") || "Not specified" : undefined;
    setBusy(true);
    await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, action, reason }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button disabled={busy} onClick={() => act("approve")} className="btn-exotic !px-4 !py-2">
        ✓ Approve
      </button>
      <button disabled={busy} onClick={() => act("reject")} className="btn-ghost !px-4 !py-2 !text-blush">
        ✕ Reject
      </button>
    </div>
  );
}

export function PayoutActions({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "paid" | "reject") {
    setBusy(true);
    await fetch("/api/admin/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutId, action }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button disabled={busy} onClick={() => act("paid")} className="btn-exotic !px-4 !py-2">
        Mark paid
      </button>
      <button disabled={busy} onClick={() => act("reject")} className="btn-ghost !px-4 !py-2 !text-blush">
        Reject
      </button>
    </div>
  );
}

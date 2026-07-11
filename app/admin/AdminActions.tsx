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

export function ReportActions({
  reportId,
  reportedIsModel,
}: {
  reportId: string;
  reportedIsModel: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: string) {
    if (action === "ban" && !confirm("Permanently ban this user?")) return;
    setBusy(true);
    await fetch("/api/admin/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, action, days: 7 }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <button disabled={busy} onClick={() => act("dismiss")} className="btn-ghost !px-3 !py-2 text-sm">
        Dismiss
      </button>
      <button disabled={busy} onClick={() => act("suspend")} className="btn-ghost !px-3 !py-2 text-sm !text-gold">
        Suspend 7d
      </button>
      {reportedIsModel && (
        <button disabled={busy} onClick={() => act("freeze")} className="btn-ghost !px-3 !py-2 text-sm !text-gold">
          Freeze payouts
        </button>
      )}
      <button disabled={busy} onClick={() => act("ban")} className="btn-ghost !px-3 !py-2 text-sm !text-blush">
        Ban
      </button>
    </div>
  );
}

export function TicketReply({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function send(close: boolean, form: HTMLFormElement) {
    const text = new FormData(form).get("text");
    if (!close && !String(text || "").trim()) return;
    setBusy(true);
    await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, text, close }),
    });
    setBusy(false);
    form.reset();
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(false, e.currentTarget);
      }}
      className="flex gap-2 pt-2 flex-wrap"
    >
      <input name="text" className="input-dark !py-2.5 flex-1 min-w-[200px]" placeholder="Reply as support…" />
      <button disabled={busy} className="btn-exotic !px-4 !py-2">
        Reply
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={(e) => send(true, e.currentTarget.closest("form")!)}
        className="btn-ghost !px-4 !py-2"
      >
        Close ticket
      </button>
    </form>
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

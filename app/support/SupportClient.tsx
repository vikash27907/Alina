"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  messages: { fromAdmin: boolean; text: string; at: string }[];
};

const REASONS = [
  "Payment / coins issue",
  "Payout question",
  "Report a user",
  "Technical problem",
  "Account help",
  "Other",
];

export default function SupportClient({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(tickets.length === 0);

  async function createTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: form.get("subject"),
        text: form.get("text"),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Failed to submit");
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function reply(ticketId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const text = new FormData(form).get("text");
    const res = await fetch("/api/support/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, text }),
    });
    if (res.ok) {
      form.reset();
      router.refresh();
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {/* new ticket */}
      {showForm ? (
        <form onSubmit={createTicket} className="card p-6 space-y-4">
          <h2 className="font-bold">New support request</h2>
          <select name="subject" required className="input-dark">
            <option value="">What is this about?</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <textarea
            name="text"
            required
            rows={4}
            className="input-dark resize-none"
            placeholder="Tell us what happened — the more detail, the faster we can help."
          />
          {error && <p className="text-blush text-sm">{error}</p>}
          <div className="flex gap-3">
            {tickets.length > 0 && (
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
                Cancel
              </button>
            )}
            <button disabled={busy} className="btn-exotic flex-1">
              {busy ? "Sending…" : "Send to support"}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="btn-exotic w-full">
          + New support request
        </button>
      )}

      {/* existing tickets */}
      {tickets.map((t) => (
        <details key={t.id} className="card overflow-hidden" open={t.status !== "CLOSED"}>
          <summary className="px-6 py-4 cursor-pointer flex items-center justify-between gap-3 list-none">
            <span className="font-semibold">{t.subject}</span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full border ${
                t.status === "ANSWERED"
                  ? "border-gold/60 text-gold"
                  : t.status === "CLOSED"
                    ? "border-edge text-mist/60"
                    : "border-violet/60 text-violet"
              }`}
            >
              {t.status === "OPEN"
                ? "Waiting for reply"
                : t.status === "ANSWERED"
                  ? "Support replied"
                  : "Closed"}
            </span>
          </summary>
          <div className="px-6 pb-5 space-y-3 border-t border-edge pt-4">
            {t.messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.fromAdmin
                    ? "bg-exotic-soft border border-violet/40"
                    : "bg-ink border border-edge ml-auto"
                }`}
              >
                <span className="block text-[11px] opacity-60 mb-0.5">
                  {m.fromAdmin ? "💜 FunWithU Support" : "You"} ·{" "}
                  {m.at.slice(0, 10)}
                </span>
                {m.text}
              </div>
            ))}
            {t.status !== "CLOSED" && (
              <form onSubmit={(e) => reply(t.id, e)} className="flex gap-2 pt-2">
                <input name="text" required className="input-dark !py-2.5" placeholder="Write a reply…" />
                <button className="btn-exotic !px-4 !py-2">➤</button>
              </form>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}

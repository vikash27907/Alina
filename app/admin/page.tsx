import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminActions, { PayoutActions } from "./AdminActions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") redirect("/login");

  const [pendingModels, pendingPayouts, stats, auditTrail] = await Promise.all([
    db.modelProfile.findMany({
      where: { status: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.payout.findMany({
      where: { status: "PENDING" },
      include: { modelProfile: { include: { user: true } } },
      orderBy: { createdAt: "asc" },
    }),
    Promise.all([
      db.user.count({ where: { role: "CUSTOMER" } }),
      db.modelProfile.count({ where: { status: "APPROVED" } }),
      db.call.count(),
      db.call.aggregate({ _sum: { coinsSpent: true } }),
    ]),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const [customers, approvedModels, totalCalls, coinAgg] = stats;

  return (
    <div className="pt-8">
      <h1 className="text-2xl font-bold">Admin</h1>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
        {[
          { label: "Customers", value: customers },
          { label: "Approved models", value: approvedModels },
          { label: "Total calls", value: totalCalls },
          { label: "Coins spent", value: coinAgg._sum.coinsSpent ?? 0 },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-mist text-xs uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-extrabold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* model applications */}
      <section className="mt-10">
        <h2 className="font-bold text-lg mb-4">
          Model applications{" "}
          <span className="text-mist text-sm">({pendingModels.length} pending)</span>
        </h2>
        {pendingModels.length === 0 && (
          <p className="text-mist/60 text-sm">Queue is empty. 🎉</p>
        )}
        <div className="space-y-4">
          {pendingModels.map((m) => (
            <div key={m.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-bold">{m.user.name}</p>
                  <p className="text-mist text-sm">{m.user.email}</p>
                  <p className="text-mist text-sm mt-1">
                    DOB {m.dob} · {m.country} · {m.languages}
                  </p>
                  <div className="flex gap-3 mt-3 text-sm">
                    <a
                      href={`/api/admin/doc/${m.idDocPath}`}
                      target="_blank"
                      className="text-blush hover:underline"
                    >
                      View ID document →
                    </a>
                    <a
                      href={`/api/admin/doc/${m.selfiePath}`}
                      target="_blank"
                      className="text-blush hover:underline"
                    >
                      View selfie →
                    </a>
                  </div>
                </div>
                <AdminActions profileId={m.id} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* payouts */}
      <section className="mt-10">
        <h2 className="font-bold text-lg mb-4">
          Payout requests{" "}
          <span className="text-mist text-sm">({pendingPayouts.length} pending)</span>
        </h2>
        {pendingPayouts.length === 0 && (
          <p className="text-mist/60 text-sm">No pending payouts.</p>
        )}
        <div className="space-y-3">
          {pendingPayouts.map((p) => (
            <div key={p.id} className="card p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-bold">
                  ₹{p.amount} · {p.method}
                </p>
                <p className="text-mist">
                  {p.modelProfile.user.name} ({p.modelProfile.user.email}) — {p.details}
                </p>
              </div>
              <PayoutActions payoutId={p.id} />
            </div>
          ))}
        </div>
      </section>

      {/* audit trail */}
      <section className="mt-10">
        <h2 className="font-bold text-lg mb-4">Audit trail</h2>
        {auditTrail.length === 0 && (
          <p className="text-mist/60 text-sm">No events yet.</p>
        )}
        <div className="card divide-y divide-edge overflow-hidden">
          {auditTrail.map((a) => (
            <div key={a.id} className="px-5 py-3 text-sm flex flex-wrap gap-x-4 gap-y-1 items-center">
              <span
                className={`font-mono text-xs px-2 py-0.5 rounded-full border ${
                  a.action.includes("FAILED") || a.action.includes("RATE_LIMITED")
                    ? "border-blush/50 text-blush"
                    : "border-edge text-mist"
                }`}
              >
                {a.action}
              </span>
              <span className="text-mist">{a.target}</span>
              {a.detail && <span className="text-mist/70">{a.detail}</span>}
              <span className="text-mist/50 ml-auto">
                {a.ip} · {a.createdAt.toISOString().replace("T", " ").slice(0, 16)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

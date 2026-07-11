import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MIN_PAYOUT } from "@/lib/economy";
import VideoRoom from "@/components/VideoRoom";
import PayoutForm from "./PayoutForm";

export const dynamic = "force-dynamic";

export default async function ModelDashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const profile = user.modelProfile;
  if (!profile) redirect("/model/apply");

  if (profile.status === "PENDING") {
    return (
      <div className="max-w-md mx-auto pt-24 text-center">
        <div className="card p-10">
          <div className="text-5xl mb-5">⏳</div>
          <h1 className="text-2xl font-bold">Application under review</h1>
          <p className="text-mist mt-3">
            Our team is verifying your documents. This usually takes a few
            hours. You&apos;ll be able to go online as soon as you&apos;re approved.
          </p>
        </div>
      </div>
    );
  }

  if (profile.status === "REJECTED") {
    return (
      <div className="max-w-md mx-auto pt-24 text-center">
        <div className="card p-10 border-blush/50">
          <div className="text-5xl mb-5">😔</div>
          <h1 className="text-2xl font-bold">Application not approved</h1>
          <p className="text-mist mt-3">
            {profile.rejectReason ||
              "Your verification could not be completed. Contact support for details."}
          </p>
        </div>
      </div>
    );
  }

  const payouts = await db.payout.findMany({
    where: { modelProfileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="pt-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hey {user.name} 👋</h1>
          <p className="text-mist text-sm">Go online whenever you&apos;re ready to earn.</p>
        </div>
        <a href="/model/live" className="btn-exotic !px-5 !py-2.5">
          🔴 Go Live
        </a>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        {[
          { label: "Balance", value: `₹${profile.balance}` },
          { label: "Lifetime earnings", value: `₹${profile.earnings}` },
          { label: "Minutes on video", value: profile.totalMinutes },
          { label: "Rating", value: `${profile.rating.toFixed(1)} ★` },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-mist text-xs uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-extrabold mt-1 text-gold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* live room */}
      <VideoRoom role="model" />

      {/* payouts */}
      <div className="grid md:grid-cols-2 gap-4 mt-8">
        <PayoutForm balance={profile.balance} minPayout={MIN_PAYOUT} />
        <div className="card p-6">
          <h3 className="font-bold mb-4">Recent payouts</h3>
          {payouts.length === 0 && (
            <p className="text-mist/60 text-sm">No payout requests yet.</p>
          )}
          <ul className="space-y-3">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span>
                  ₹{p.amount} · {p.method}
                </span>
                <span
                  className={
                    p.status === "PAID"
                      ? "text-green-400"
                      : p.status === "REJECTED"
                        ? "text-blush"
                        : "text-gold"
                  }
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

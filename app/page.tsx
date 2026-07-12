import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { COIN_PACKAGES } from "@/lib/economy";

export default async function Landing() {
  const user = await currentUser();

  return (
    <div className="pt-14 sm:pt-20">
      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto">
        <p className="inline-block text-xs tracking-widest uppercase text-mist border border-edge rounded-full px-4 py-1.5 mb-6 bg-surface/60">
          18+ · Live · Private · Verified
        </p>
        <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight">
          Real people.{" "}
          <span className="text-transparent bg-clip-text bg-exotic">
            Live video.
          </span>
          <br />
          One tap away.
        </h1>
        <p className="text-mist text-lg mt-6 max-w-xl mx-auto">
          FunWithU connects you 1-on-1 with verified models on smooth live
          video. No swiping, no waiting — press play and meet someone now.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
          <Link href={user ? "/chat" : "/signup"} className="btn-exotic text-lg !px-9 !py-4">
            ▶ Start video chat
          </Link>
          <Link href="/model/apply" className="btn-ghost text-lg !px-9 !py-4">
            Earn as a model
          </Link>
        </div>
        <p className="text-mist/70 text-sm mt-4">
Your first minute is on us — no card needed.
        </p>
      </section>

      {/* How it works */}
      <section className="grid sm:grid-cols-3 gap-4 mt-24">
        {[
          {
            icon: "✨",
            title: "Join in seconds",
            text: "One short form. No public profile, no gallery — your privacy stays yours.",
          },
          {
            icon: "🎥",
            title: "Tap to connect",
            text: "We instantly pair you with a verified model on live HD video with chat.",
          },
          {
            icon: "💫",
            title: "Vibe or skip",
            text: "Enjoy the moment, send a gift, or skip to the next person any time.",
          },
        ].map((f) => (
          <div key={f.title} className="card p-7">
            <div className="text-3xl mb-4">{f.icon}</div>
            <h3 className="font-bold text-lg mb-2">{f.title}</h3>
            <p className="text-mist text-sm leading-relaxed">{f.text}</p>
          </div>
        ))}
      </section>

      {/* Pricing teaser */}
      <section className="mt-24 text-center">
        <h2 className="text-3xl font-bold">Simple pricing</h2>
        <p className="text-mist mt-2">Coins power your video time. No hidden fees.</p>
        <div className="grid sm:grid-cols-3 gap-4 mt-8 max-w-3xl mx-auto">
          {COIN_PACKAGES.map((p) => (
            <div
              key={p.id}
              className={`card p-7 ${p.id === "medium" ? "border-blush/60 shadow-glow" : ""}`}
            >
              <p className="text-xs uppercase tracking-widest text-mist">{p.tag}</p>
              <p className="text-3xl font-extrabold mt-3">
                <span className="text-gold">{p.coins}</span>{" "}
                <span className="text-base font-medium text-mist">coins</span>
              </p>
              <p className="text-xl font-bold mt-1">₹{p.price}</p>
            </div>
          ))}
        </div>
        <Link href="/coins" className="btn-ghost mt-8">
          View coin packs →
        </Link>
      </section>

      {/* Model CTA */}
      <section className="card mt-24 p-10 text-center bg-exotic-soft">
        <h2 className="text-3xl font-bold">Earn from your charm 💸</h2>
        <p className="text-mist mt-3 max-w-xl mx-auto">
          Verified models earn per minute of video chat plus 60% of every gift.
          Work from anywhere, get paid weekly, stay fully in control.
        </p>
        <Link href="/model/apply" className="btn-exotic mt-7">
          Apply as a model
        </Link>
      </section>

      <footer className="text-center text-mist/60 text-sm mt-20 space-y-3">
        <p>funwithu.in — for adults 18+ only. Be kind, stay safe.</p>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link href="/legal/terms" className="hover:text-white">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/legal/community-guidelines" className="hover:text-white">Guidelines</Link>
          <Link href="/legal/refund-policy" className="hover:text-white">Refunds</Link>
          <Link href="/legal/grievance" className="hover:text-white">Grievance</Link>
          <Link href="/legal" className="hover:text-white">All policies</Link>
        </nav>
        <p>© {new Date().getFullYear()} FunWithU</p>
      </footer>
    </div>
  );
}

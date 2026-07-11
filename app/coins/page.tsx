import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { COIN_PACKAGES, COINS_PER_MIN } from "@/lib/economy";
import BuyButton from "./BuyButton";

export const dynamic = "force-dynamic";

export default async function CoinsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="pt-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center">Get coins</h1>
      <p className="text-mist text-center mt-2">
        You have <span className="text-gold font-semibold">{user.coins}</span>{" "}
        coins · video chat costs {COINS_PER_MIN} coins/minute
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mt-10">
        {COIN_PACKAGES.map((p) => (
          <div
            key={p.id}
            className={`card p-7 text-center flex flex-col ${
              p.id === "medium" ? "border-blush/60 shadow-glow" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-widest text-mist">{p.tag}</p>
            <p className="text-4xl font-extrabold mt-4 text-gold">{p.coins}</p>
            <p className="text-mist text-sm">coins</p>
            <p className="text-mist text-xs mt-2">
              ≈ {Math.floor(p.coins / COINS_PER_MIN)} minutes of video
            </p>
            <p className="text-2xl font-bold mt-4">₹{p.price}</p>
            <BuyButton packageId={p.id} />
          </div>
        ))}
      </div>

      <p className="text-mist/60 text-xs text-center mt-8 max-w-md mx-auto">
        Demo checkout: coins are credited instantly. The payment gateway
        (high-risk processor) plugs in here before launch.
      </p>
    </div>
  );
}

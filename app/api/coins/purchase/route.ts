import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { COIN_PACKAGES } from "@/lib/economy";

/**
 * Demo checkout. In production this becomes a two-step flow:
 *  1. create an order with the payment processor (Segpay/CCBill/etc.)
 *  2. credit coins only from the processor's signed webhook.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { packageId } = await req.json();
  const pack = COIN_PACKAGES.find((p) => p.id === packageId);
  if (!pack) return NextResponse.json({ error: "Unknown package" }, { status: 400 });

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { coins: { increment: pack.coins } },
    }),
    db.transaction.create({
      data: {
        userId: user.id,
        type: "PURCHASE",
        coins: pack.coins,
        meta: `${pack.id} pack · ₹${pack.price} (demo)`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

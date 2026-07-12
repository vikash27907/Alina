import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MIN_PAYOUT_PAISE } from "@/lib/economy";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.modelProfile || user.modelProfile.status !== "APPROVED")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.modelProfile.payoutFrozen)
    return NextResponse.json(
      { error: "Payouts are temporarily on hold for your account. Contact support." },
      { status: 403 }
    );

  const { amountRupees, method, details } = await req.json();
  const paise = Math.floor(Number(amountRupees) * 100);

  if (!Number.isFinite(paise) || paise < MIN_PAYOUT_PAISE)
    return NextResponse.json(
      { error: `Minimum payout is ₹${MIN_PAYOUT_PAISE / 100}.` },
      { status: 400 }
    );
  if (paise > user.modelProfile.balance)
    return NextResponse.json({ error: "Amount exceeds your balance." }, { status: 400 });
  // Only UPI and Indian bank transfer are supported at launch. PayPal/crypto
  // remain valid enum values in the schema (zero-migration to re-enable later)
  // but are rejected here — this server check is the real security line.
  if (!["UPI", "BANK"].includes(method))
    return NextResponse.json({ error: "That payout method isn't available." }, { status: 400 });
  if (!details || String(details).length < 3)
    return NextResponse.json({ error: "Payment details are required." }, { status: 400 });

  await db.$transaction([
    db.modelProfile.update({
      where: { id: user.modelProfile.id },
      data: { balance: { decrement: paise } },
    }),
    db.payout.create({
      data: {
        modelProfileId: user.modelProfile.id,
        amount: paise,
        method,
        details: String(details).slice(0, 200),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

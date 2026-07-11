import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { payoutId, action } = await req.json();
  if (!payoutId || !["paid", "reject"].includes(action))
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const payout = await db.payout.findUnique({ where: { id: payoutId } });
  if (!payout || payout.status !== "PENDING")
    return NextResponse.json({ error: "Payout not found or already processed" }, { status: 404 });

  if (action === "paid") {
    await db.payout.update({
      where: { id: payoutId },
      data: { status: "PAID", processedAt: new Date() },
    });
  } else {
    // rejected payouts return the money to the model's balance
    await db.$transaction([
      db.payout.update({
        where: { id: payoutId },
        data: { status: "REJECTED", processedAt: new Date() },
      }),
      db.modelProfile.update({
        where: { id: payout.modelProfileId },
        data: { balance: { increment: payout.amount } },
      }),
    ]);
  }

  return NextResponse.json({ ok: true });
}

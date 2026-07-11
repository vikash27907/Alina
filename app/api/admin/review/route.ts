import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profileId, action, reason } = await req.json();
  if (!profileId || !["approve", "reject"].includes(action))
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  await db.modelProfile.update({
    where: { id: profileId },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      reviewedAt: new Date(),
      rejectReason: action === "reject" ? String(reason || "").slice(0, 300) : null,
    },
  });

  return NextResponse.json({ ok: true });
}

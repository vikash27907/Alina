import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";

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

  await audit({
    actorId: user.id,
    action: action === "approve" ? "MODEL_APPROVED" : "MODEL_REJECTED",
    target: profileId,
    detail: action === "reject" ? String(reason || "") : "",
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}

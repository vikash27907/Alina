import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";

const ACTIONS = ["dismiss", "suspend", "ban", "freeze", "unfreeze", "unban"] as const;

// act on a report (dismiss/suspend/ban/freeze) — or directly on a user (unban/unfreeze)
export async function POST(req: Request) {
  const admin = await currentUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportId, userId, action, days } = await req.json();
  if (!ACTIONS.includes(action))
    return NextResponse.json({ error: "Bad action" }, { status: 400 });

  let targetUserId = userId as string | undefined;
  let report = null;
  if (reportId) {
    report = await db.report.findUnique({ where: { id: reportId } });
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    targetUserId = report.reportedId;
  }
  if (!targetUserId)
    return NextResponse.json({ error: "No target user" }, { status: 400 });

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    include: { modelProfile: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "ADMIN")
    return NextResponse.json({ error: "Cannot moderate an admin." }, { status: 400 });

  const ops: any[] = [];
  let resolution = "";

  if (action === "suspend") {
    const d = Math.min(Math.max(Number(days) || 7, 1), 365);
    ops.push(
      db.user.update({
        where: { id: target.id },
        data: {
          status: "SUSPENDED",
          suspendedUntil: new Date(Date.now() + d * 24 * 3600 * 1000),
        },
      })
    );
    resolution = `suspended ${d} days`;
  } else if (action === "ban") {
    ops.push(
      db.user.update({
        where: { id: target.id },
        data: { status: "BANNED", suspendedUntil: null },
      })
    );
    resolution = "banned";
  } else if (action === "unban") {
    ops.push(
      db.user.update({
        where: { id: target.id },
        data: { status: "ACTIVE", suspendedUntil: null },
      })
    );
    resolution = "unbanned";
  } else if (action === "freeze" || action === "unfreeze") {
    if (!target.modelProfile)
      return NextResponse.json({ error: "User is not a model." }, { status: 400 });
    ops.push(
      db.modelProfile.update({
        where: { id: target.modelProfile.id },
        data: { payoutFrozen: action === "freeze" },
      })
    );
    resolution = action === "freeze" ? "payouts frozen" : "payouts unfrozen";
  } else {
    resolution = "dismissed";
  }

  if (report) {
    ops.push(
      db.report.update({
        where: { id: report.id },
        data: {
          status: action === "dismiss" ? "DISMISSED" : "ACTIONED",
          resolution,
          resolvedAt: new Date(),
        },
      })
    );
  }

  await db.$transaction(ops);
  await audit({
    actorId: admin.id,
    action: `MOD_${action.toUpperCase()}`,
    target: target.email,
    detail: report ? `report ${report.id}: ${report.reason}` : "",
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}

import { db } from "./db";

export async function audit(entry: {
  actorId: string;
  action: string;
  target?: string;
  detail?: string;
  ip?: string;
}) {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        target: entry.target ?? "",
        detail: (entry.detail ?? "").slice(0, 500),
        ip: entry.ip ?? "",
      },
    });
  } catch (e) {
    // auditing must never take the request down
    console.error("audit write failed", e);
  }
}

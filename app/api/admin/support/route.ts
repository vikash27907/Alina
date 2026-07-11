import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";

// admin replies to / closes a support ticket
export async function POST(req: Request) {
  const admin = await currentUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId, text, close } = await req.json();
  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const ops: any[] = [];
  if (text && String(text).trim()) {
    ops.push(
      db.supportMessage.create({
        data: { ticketId, fromAdmin: true, text: String(text).slice(0, 2000) },
      })
    );
  }
  ops.push(
    db.supportTicket.update({
      where: { id: ticketId },
      data: { status: close ? "CLOSED" : "ANSWERED" },
    })
  );

  await db.$transaction(ops);
  await audit({
    actorId: admin.id,
    action: close ? "SUPPORT_CLOSED" : "SUPPORT_REPLIED",
    target: ticketId,
    ip: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}

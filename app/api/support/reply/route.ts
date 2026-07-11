import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// user replies on their own ticket
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ticketId, text } = await req.json();
  if (!ticketId || !text || !String(text).trim())
    return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.userId !== user.id)
    return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (ticket.status === "CLOSED")
    return NextResponse.json({ error: "This ticket is closed. Open a new one." }, { status: 400 });

  await db.$transaction([
    db.supportMessage.create({
      data: { ticketId, text: String(text).slice(0, 2000) },
    }),
    db.supportTicket.update({ where: { id: ticketId }, data: { status: "OPEN" } }),
  ]);

  return NextResponse.json({ ok: true });
}

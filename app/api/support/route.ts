import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// create a support ticket (customers, models — anyone logged in)
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`support:${user.id}`, 5, 60 * 60 * 1000))
    return NextResponse.json(
      { error: "Too many tickets. Please wait before opening another." },
      { status: 429 }
    );

  const { subject, text } = await req.json();
  if (!subject || !String(subject).trim() || !text || !String(text).trim())
    return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });

  const ticket = await db.supportTicket.create({
    data: {
      userId: user.id,
      subject: String(subject).slice(0, 120),
      messages: { create: { text: String(text).slice(0, 2000) } },
    },
  });

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}

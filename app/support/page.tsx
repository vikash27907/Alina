import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import SupportClient from "./SupportClient";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const tickets = await db.supportTicket.findMany({
    where: { userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="max-w-2xl mx-auto pt-10">
      <h1 className="text-3xl font-bold">Support</h1>
      <p className="text-mist mt-2">
        Questions, payment issues, reports — write to us and the team will
        reply here. You&apos;ll see answers on this page.
      </p>
      <SupportClient
        tickets={tickets.map((t) => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
          messages: t.messages.map((m) => ({
            fromAdmin: m.fromAdmin,
            text: m.text,
            at: m.createdAt.toISOString(),
          })),
        }))}
      />
    </div>
  );
}

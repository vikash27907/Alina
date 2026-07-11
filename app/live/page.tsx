import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import LiveBrowser from "@/components/LiveBrowser";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live — FunWithU" };

export default async function LivePage() {
  const user = await currentUser();
  const isPayer = user
    ? !!(await db.transaction.findFirst({
        where: { userId: user.id, type: "PURCHASE" },
        select: { id: true },
      }))
    : false;

  return <LiveBrowser loggedIn={!!user} isPayer={isPayer} />;
}

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import CoupleRoom from "@/components/CoupleRoom";

export const dynamic = "force-dynamic";
export const metadata = { title: "Couple room — FunWithU" };

export default async function RoomHome() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <CoupleRoom myId={user.id} myName={user.name} />;
}

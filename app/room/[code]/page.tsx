import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import CoupleRoom from "@/components/CoupleRoom";

export const dynamic = "force-dynamic";
export const metadata = { title: "Couple room — FunWithU" };

export default async function RoomByCode({ params }: { params: { code: string } }) {
  const user = await currentUser();
  if (!user) redirect(`/login?next=/room/${params.code}`);
  const code = params.code.toUpperCase().slice(0, 6);
  return <CoupleRoom myId={user.id} myName={user.name} joinCode={code} />;
}

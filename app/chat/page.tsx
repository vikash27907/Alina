import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import VideoRoom from "@/components/VideoRoom";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.modelProfile) redirect("/model/dashboard");

  return (
    <div>
      <VideoRoom role="customer" initialCoins={user.coins} />
    </div>
  );
}

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import LiveStudio from "@/components/LiveStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live studio — FunWithU" };

export default async function ModelLivePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.modelProfile) redirect("/model/apply");
  if (user.modelProfile.status !== "APPROVED") redirect("/model/dashboard");

  return <LiveStudio />;
}

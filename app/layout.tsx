import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "FunWithU — Live 1-on-1 Video Chat",
  description:
    "Meet verified people on live video. Simple, private, and fun — funwithu.in",
};

export const viewport: Viewport = {
  themeColor: "#0b0812",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <Navbar
          user={
            user
              ? {
                  name: user.name,
                  role: user.role,
                  coins: user.coins,
                  modelStatus: user.modelProfile?.status ?? null,
                }
              : null
          }
        />
        <main className="mx-auto max-w-6xl px-4 pb-16">{children}</main>
      </body>
    </html>
  );
}

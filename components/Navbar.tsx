"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type NavUser = {
  name: string;
  role: string;
  coins: number;
  modelStatus: string | null;
} | null;

export default function Navbar({ user }: { user: NavUser }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-night/70 border-b border-edge">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">💜</span>
          <span className="font-bold text-lg tracking-tight">
            Fun<span className="text-transparent bg-clip-text bg-exotic">WithU</span>
          </span>
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <Link href="/live" className="text-mist hover:text-white px-2">
            🔴 Live
          </Link>
          {!user && (
            <>
              <Link href="/model/apply" className="text-mist hover:text-white px-2 hidden sm:block">
                Become a model
              </Link>
              <Link href="/login" className="btn-ghost !px-4 !py-2">
                Log in
              </Link>
              <Link href="/signup" className="btn-exotic !px-4 !py-2">
                Join free
              </Link>
            </>
          )}

          {user && user.role === "CUSTOMER" && !user.modelStatus && (
            <>
              <Link href="/support" className="text-mist hover:text-white px-2 hidden sm:block">
                Support
              </Link>
              <Link
                href="/coins"
                className="flex items-center gap-1.5 bg-surface border border-edge rounded-2xl px-3 py-2 hover:border-gold/60"
              >
                <span className="text-gold">●</span>
                <span className="font-semibold">{user.coins}</span>
                <span className="text-mist hidden sm:inline">coins</span>
              </Link>
              <Link href="/chat" className="btn-exotic !px-4 !py-2">
                Start chat
              </Link>
              <button onClick={logout} className="text-mist hover:text-white px-2">
                Exit
              </button>
            </>
          )}

          {user && user.modelStatus && (
            <>
              <Link href="/support" className="text-mist hover:text-white px-2 hidden sm:block">
                Support
              </Link>
              <Link href="/model/dashboard" className="btn-exotic !px-4 !py-2">
                Dashboard
              </Link>
              <button onClick={logout} className="text-mist hover:text-white px-2">
                Exit
              </button>
            </>
          )}

          {user && user.role === "ADMIN" && (
            <>
              <Link href="/admin" className="btn-exotic !px-4 !py-2">
                Admin
              </Link>
              <button onClick={logout} className="text-mist hover:text-white px-2">
                Exit
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

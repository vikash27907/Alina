import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Uptime monitor target: confirms the app AND the database are alive.
// The trivial query also counts as activity so free-tier Postgres
// providers (e.g. Supabase) don't pause the project for inactivity.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}

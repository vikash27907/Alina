import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken, TOKEN_COOKIE } from "@/lib/auth";
import { rateLimit, rateLimitReset, clientIp } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const { email, password } = await req.json();
  if (!email || !password)
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

  const emailNorm = String(email).toLowerCase();
  const key = `login:${ip}:${emailNorm}`;

  // brute-force lockout: 5 attempts per 15 minutes per IP+email
  if (!rateLimit(key, 5, 15 * 60 * 1000)) {
    await audit({
      actorId: "anonymous",
      action: "LOGIN_RATE_LIMITED",
      target: emailNorm,
      ip,
    });
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  const user = await db.user.findUnique({
    where: { email: emailNorm },
    include: { modelProfile: true },
  });

  // constant-shape failure path: same error whether the email exists or not
  const ok = user && (await bcrypt.compare(String(password), user.password));
  if (!ok) {
    if (user?.role === "ADMIN") {
      await audit({
        actorId: "anonymous",
        action: "ADMIN_LOGIN_FAILED",
        target: emailNorm,
        ip,
      });
    }
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  if (user.status === "BANNED")
    return NextResponse.json(
      { error: "This account has been permanently banned." },
      { status: 403 }
    );
  if (user.status === "SUSPENDED" && user.suspendedUntil) {
    if (user.suspendedUntil > new Date()) {
      return NextResponse.json(
        {
          error: `Account suspended until ${user.suspendedUntil.toISOString().slice(0, 10)}. Contact support if you believe this is a mistake.`,
        },
        { status: 403 }
      );
    }
    // suspension expired — reactivate
    await db.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", suspendedUntil: null },
    });
  }

  rateLimitReset(key);
  if (user.role === "ADMIN") {
    await audit({ actorId: user.id, action: "ADMIN_LOGIN", ip });
  }

  const redirect =
    user.role === "ADMIN"
      ? "/admin"
      : user.modelProfile
        ? "/model/dashboard"
        : "/chat";

  const res = NextResponse.json({ ok: true, redirect });
  res.cookies.set(TOKEN_COOKIE, signToken({ uid: user.id, role: user.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}

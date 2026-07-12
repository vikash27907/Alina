import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken, TOKEN_COOKIE } from "@/lib/auth";

import { rateLimit, clientIp } from "@/lib/ratelimit";

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`signup:${ip}`, 10, 60 * 60 * 1000))
    return NextResponse.json(
      { error: "Too many signups from this network. Try again later." },
      { status: 429 }
    );

  const { name, email, password, adult } = await req.json();

  if (!name || !email || !password)
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  if (!adult)
    return NextResponse.json({ error: "You must be 18 or older." }, { status: 400 });
  if (String(password).length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const exists = await db.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (exists)
    return NextResponse.json({ error: "That email is already registered." }, { status: 409 });

  // Small welcome grant: 10 coins ≈ 1 free minute of video to try the product.
  const SIGNUP_BONUS = 10;
  const user = await db.user.create({
    data: {
      name: String(name).slice(0, 40),
      email: String(email).toLowerCase(),
      password: await bcrypt.hash(String(password), 10),
      coins: SIGNUP_BONUS,
      transactions: {
        create: { type: "TRIAL", coins: SIGNUP_BONUS, meta: "signup bonus" },
      },
    },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(TOKEN_COOKIE, signToken({ uid: user.id, role: user.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}

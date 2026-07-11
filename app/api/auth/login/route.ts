import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken, TOKEN_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password)
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

  const user = await db.user.findUnique({
    where: { email: String(email).toLowerCase() },
    include: { modelProfile: true },
  });
  if (!user || !(await bcrypt.compare(String(password), user.password)))
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });

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

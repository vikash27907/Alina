import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken, TOKEN_COOKIE } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const MAX_DATAURL = 7_000_000; // ~5 MB image once base64-encoded

// Verification photos arrive as data URLs (captured live from the camera, or
// uploaded) and are stored in the database. This keeps them off the ephemeral
// per-instance filesystem so they survive restarts and behave the same on any
// host. Access stays restricted to admins.
function validImage(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) &&
    s.length <= MAX_DATAURL
  );
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch (e: any) {
    console.error("model apply error:", e);
    return NextResponse.json(
      { error: "Something went wrong submitting your application. Please try again." },
      { status: 500 }
    );
  }
}

async function handle(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`model-apply:${ip}`, 5, 60 * 60 * 1000))
    return NextResponse.json(
      { error: "Too many applications from this network. Try again later." },
      { status: 429 }
    );

  const body = await req.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const name = String(body.name || "").slice(0, 40);
  const email = String(body.email || "").toLowerCase().trim();
  const password = String(body.password || "");
  const dob = String(body.dob || "");
  const country = String(body.country || "").slice(0, 60);
  const languages = String(body.languages || "").slice(0, 120);
  const adult = !!body.adult;
  const idDoc = body.idDoc;
  const selfie = body.selfie;

  if (!name || !email || !password || !dob || !country || !languages)
    return NextResponse.json({ error: "Please fill in all the details." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email))
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  if (!adult)
    return NextResponse.json({ error: "You must confirm you are 18+." }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (!validImage(idDoc))
    return NextResponse.json({ error: "A clear photo of your government ID is required." }, { status: 400 });
  if (!validImage(selfie))
    return NextResponse.json({ error: "A live selfie holding your ID is required." }, { status: 400 });

  // must be 18+ by date of birth
  const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!Number.isFinite(age) || age < 18)
    return NextResponse.json({ error: "You must be at least 18 years old." }, { status: 400 });

  const exists = await db.user.findUnique({ where: { email } });
  if (exists)
    return NextResponse.json({ error: "That email is already registered." }, { status: 409 });

  const user = await db.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: "MODEL",
      coins: 0,
      modelProfile: {
        create: { country, dob, languages, idDocPath: idDoc, selfiePath: selfie },
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

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken, TOKEN_COOKIE } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const MAX_FILE = 5 * 1024 * 1024; // 5 MB per image

// Verification photos are stored in the database as data URLs. This keeps them
// off the (ephemeral, per-instance) filesystem so they survive restarts and
// behave identically on any host. Access stays restricted to admins.
async function toDataUrl(file: File): Promise<string> {
  if (file.size > MAX_FILE) throw new Error("Each image must be under 5 MB.");
  if (!file.type.startsWith("image/"))
    throw new Error("Only image files are accepted.");
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return `data:${file.type};base64,${b64}`;
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

  const form = await req.formData();
  const name = String(form.get("name") || "").slice(0, 40);
  const email = String(form.get("email") || "").toLowerCase();
  const password = String(form.get("password") || "");
  const dob = String(form.get("dob") || "");
  const country = String(form.get("country") || "").slice(0, 60);
  const languages = String(form.get("languages") || "").slice(0, 120);
  const adult = form.get("adult");
  const idDoc = form.get("idDoc");
  const selfie = form.get("selfie");

  if (!name || !email || !password || !dob || !country || !languages)
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  if (!adult)
    return NextResponse.json({ error: "You must confirm you are 18+." }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (!(idDoc instanceof File) || !(selfie instanceof File) || idDoc.size === 0 || selfie.size === 0)
    return NextResponse.json({ error: "Both verification photos are required." }, { status: 400 });

  // must be 18+ by date of birth
  const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!Number.isFinite(age) || age < 18)
    return NextResponse.json({ error: "You must be at least 18 years old." }, { status: 400 });

  const exists = await db.user.findUnique({ where: { email } });
  if (exists)
    return NextResponse.json({ error: "That email is already registered." }, { status: 409 });

  let idDocPath: string, selfiePath: string;
  try {
    idDocPath = await toDataUrl(idDoc);
    selfiePath = await toDataUrl(selfie);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Could not process the images." }, { status: 400 });
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: "MODEL",
      coins: 0,
      modelProfile: {
        create: { country, dob, languages, idDocPath, selfiePath },
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

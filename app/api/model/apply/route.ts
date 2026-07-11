import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { db } from "@/lib/db";
import { signToken, TOKEN_COOKIE } from "@/lib/auth";

import { rateLimit, clientIp } from "@/lib/ratelimit";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_FILE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic"]);

async function saveUpload(file: File, prefix: string) {
  if (file.size > MAX_FILE) throw new Error("File too large (max 8 MB).");
  if (!file.type.startsWith("image/"))
    throw new Error("Only image files are accepted.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!ALLOWED_EXT.has(ext))
    throw new Error("Only JPG, PNG, WEBP or HEIC images are accepted.");
  const name = `${prefix}-${crypto.randomBytes(12).toString("hex")}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function POST(req: Request) {
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
  if (!(idDoc instanceof File) || !(selfie instanceof File))
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
    idDocPath = await saveUpload(idDoc, "id");
    selfiePath = await saveUpload(selfie, "selfie");
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload failed." }, { status: 400 });
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

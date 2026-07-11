import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "./db";

const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  (!process.env.AUTH_SECRET ||
    process.env.AUTH_SECRET.includes("change-me") ||
    process.env.AUTH_SECRET.length < 32)
) {
  throw new Error(
    "FATAL: AUTH_SECRET must be set to a random string of 32+ characters in production. " +
      "Generate one with: openssl rand -base64 48"
  );
}
export const TOKEN_COOKIE = "fwu_token";

export type TokenPayload = { uid: string; role: string };

export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function currentUser() {
  const token = cookies().get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return db.user.findUnique({
    where: { id: payload.uid },
    include: { modelProfile: true },
  });
}

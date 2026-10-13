import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "./db";

export const COOKIE = "tm_token";
const MAX_AGE = 60 * 60 * 24 * 7;

export type Session = { id: string; role: "USER" | "ADMIN" };

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error("JWT_SECRET must be set (>= 16 chars)");
  return new TextEncoder().encode(s);
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function signToken(s: Session) {
  return new SignJWT({ role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return { id: payload.sub, role: payload.role === "ADMIN" ? "ADMIN" : "USER" };
  } catch {
    return null;
  }
}

export async function setSessionCookie(s: Session) {
  (await cookies()).set(COOKIE, await signToken(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  return t ? verifyToken(t) : null;
}

/** Session + fresh user row (role changes take effect immediately). */
export async function getCurrentUser() {
  const s = await getSession();
  if (!s) return null;
  return db.user.findUnique({ where: { id: s.id }, select: { id: true, email: true, name: true, role: true } });
}

// Edge-safe token verification (no next/headers, no Prisma) for middleware.
import { jwtVerify } from "jose";

export const COOKIE = "tm_token";

export async function verifyToken(token: string): Promise<{ id: string; role: "USER" | "ADMIN" } | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET ?? ""));
    if (!payload.sub) return null;
    return { id: payload.sub, role: payload.role === "ADMIN" ? "ADMIN" : "USER" };
  } catch {
    return null;
  }
}

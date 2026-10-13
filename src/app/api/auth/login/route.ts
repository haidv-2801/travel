import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { handler, parse, HttpError } from "@/lib/http";
import { loginSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

export const POST = handler(async (req) => {
  const data = await parse(req, loginSchema);
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`login:${ip}:${data.email}`, 8, 15 * 60_000)) throw new HttpError(429, "Too many attempts");
  const user = await db.user.findUnique({ where: { email: data.email } });
  if (!user || !(await verifyPassword(data.password, user.passwordHash))) throw new HttpError(401, "Invalid email or password");
  await setSessionCookie({ id: user.id, role: user.role });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

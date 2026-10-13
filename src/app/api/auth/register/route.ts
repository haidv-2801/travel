import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { handler, parse, HttpError } from "@/lib/http";
import { registerSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

export const POST = handler(async (req) => {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`register:${ip}`, 10, 3600_000)) throw new HttpError(429, "Too many attempts");
  const data = await parse(req, registerSchema);
  if (await db.user.findUnique({ where: { email: data.email } })) throw new HttpError(409, "Email already registered");
  const user = await db.user.create({
    data: { name: data.name, email: data.email, passwordHash: await hashPassword(data.password) },
  });
  await setSessionCookie({ id: user.id, role: user.role });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role }, { status: 201 });
});

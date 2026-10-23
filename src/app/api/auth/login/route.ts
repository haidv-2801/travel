import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { handler, parse, HttpError } from "@/lib/http";
import { loginSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

export const POST = handler(async (req) => {
  const data = await parse(req, loginSchema);
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`login:${ip}:${data.email}`, 8, 15 * 60_000)) throw new HttpError(429, "Too many attempts");
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword(data);
  if (error) throw new HttpError(401, "Invalid email or password");
  return NextResponse.json(await getCurrentUser(sb));
});

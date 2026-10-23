import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handler, parse, HttpError } from "@/lib/http";
import { registerSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";

export const POST = handler(async (req) => {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`register:${ip}`, 10, 3600_000)) throw new HttpError(429, "Too many attempts");
  const data = await parse(req, registerSchema);
  const sb = await createClient();
  const { data: res, error } = await sb.auth.signUp({ email: data.email, password: data.password, options: { data: { name: data.name } } });
  if (error) {
    if (error.code === "user_already_exists") throw new HttpError(409, "Email already registered");
    if (error.status === 429) throw new HttpError(429, "Too many attempts");
    throw new HttpError(400, error.message);
  }
  // With email confirmation on, an already-registered address returns a user with no identities.
  if (res.user && res.user.identities?.length === 0) throw new HttpError(409, "Email already registered");
  // No session = the project requires email confirmation first.
  if (!res.session) return NextResponse.json({ needsConfirmation: true }, { status: 202 });
  return NextResponse.json({ id: res.user!.id, name: data.name, email: data.email }, { status: 201 });
});

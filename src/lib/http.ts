import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { getCurrentUser } from "./auth";
import { rateLimit } from "./rate-limit";
import { createClient } from "./supabase/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler: rate limiting + uniform error responses. */
export function handler<P = Record<string, never>>(fn: (req: Request, ctx: Ctx<P>) => Promise<Response>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
      if (!rateLimit(`${ip}:${req.method}`, 120, 60_000)) throw new HttpError(429, "Too many requests");
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json({ error: "Validation failed", issues: e.flatten().fieldErrors }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export async function parse<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
  return schema.parse(body);
}

export type Db = Awaited<ReturnType<typeof createClient>>;

/** Signed-in user plus a Supabase client acting as them (Row Level Security applies to every query). */
export async function requireUser() {
  const sb = await createClient();
  const u = await getCurrentUser(sb);
  if (!u) throw new HttpError(401, "Unauthorized");
  return { ...u, sb };
}

type Result = { data: unknown; error: { code?: string; message: string } | null };

/**
 * Unwraps a Supabase result: database errors become HTTP errors (RLS denial 403, malformed id 404, anything else 500).
 * Rows are untyped (no generated types), so the result is `any`; mappers in lib/mappers.ts give the API its shape.
 */
export function must<T = any>(r: Result): T {
  if (r.error) {
    if (r.error.code === "42501") throw new HttpError(403, "Forbidden");
    if (r.error.code === "22P02" || r.error.code === "PGRST116") throw new HttpError(404, "Not found");
    throw new Error(r.error.message);
  }
  return r.data as T;
}

import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { getCurrentUser } from "./auth";
import { rateLimit } from "./rate-limit";

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

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Unauthorized");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new HttpError(403, "Forbidden");
  return u;
}

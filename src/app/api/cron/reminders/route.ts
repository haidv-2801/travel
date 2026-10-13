import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handler, HttpError } from "@/lib/http";
import { generateReminders } from "@/lib/notifications";

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "Background jobs are disabled: set CRON_SECRET");
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer /i, ""));
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) throw new HttpError(401, "Unauthorized");
}

/**
 * Background job: creates trip reminders for every user, without anyone opening the app.
 * Called on a schedule (see .github/workflows/reminders.yml; Vercel Cron also sends GET with the same Bearer header).
 * Protected by CRON_SECRET; idempotent, so extra or overlapping runs are harmless.
 */
const run = handler(async (req) => {
  authorised(req);
  return NextResponse.json(await generateReminders());
});
export const GET = run;
export const POST = run;

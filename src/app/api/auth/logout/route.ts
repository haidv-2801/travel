import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { handler } from "@/lib/http";

export const POST = handler(async () => {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});

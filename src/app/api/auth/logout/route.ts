import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handler } from "@/lib/http";

export const POST = handler(async () => {
  await (await createClient()).auth.signOut();
  return NextResponse.json({ ok: true });
});

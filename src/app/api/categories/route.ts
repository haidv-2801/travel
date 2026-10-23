import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handler, must } from "@/lib/http";
import { categoryOut } from "@/lib/mappers";

export const GET = handler(async () => {
  const sb = await createClient();
  return NextResponse.json(must(await sb.from("categories").select("*").order("name")).map(categoryOut));
});

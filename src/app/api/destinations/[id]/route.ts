import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handler, HttpError, must } from "@/lib/http";
import { destinationOut } from "@/lib/mappers";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const sb = await createClient();
  const d = must(await sb.from("destinations").select("*, categories(*)").eq(UUID.test(id) ? "id" : "slug", id).maybeSingle());
  if (!d) throw new HttpError(404, "Not found");
  return NextResponse.json(destinationOut(d));
});

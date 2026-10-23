import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handler } from "@/lib/http";
import { destinationOut } from "@/lib/mappers";
import { normalize } from "@/lib/text";
import { searchDestinations } from "@/lib/destinations";

export const GET = handler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize")) || 12));
  const { items, total } = await searchDestinations(await createClient(), {
    q: sp.get("q")?.trim() ? normalize(sp.get("q")!.trim()) : undefined,
    region: sp.get("region") ?? undefined,
    category: sp.get("category") ?? undefined,
    maxCost: sp.get("maxCost") ? Number(sp.get("maxCost")) || 0 : undefined,
    page,
    pageSize,
  });
  return NextResponse.json({ items: items.map(destinationOut), total, page, pageSize });
});

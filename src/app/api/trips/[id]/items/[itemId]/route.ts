import { NextResponse } from "next/server";
import { handler, must, requireUser, HttpError } from "@/lib/http";
import { tripAccess } from "@/lib/trips";

export const DELETE = handler<{ id: string; itemId: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, itemId } = await params;
  await tripAccess(u.sb, id, u.id, "edit");
  const r = must(await u.sb.from("trip_items").delete().eq("id", itemId).eq("trip_id", id).select("id"));
  if (!r.length) throw new HttpError(404, "Item not found");
  return NextResponse.json({ ok: true });
});

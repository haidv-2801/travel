import { NextResponse } from "next/server";
import { handler, must, parse, requireUser, HttpError } from "@/lib/http";
import { voteSchema } from "@/lib/validators";
import { tripAccess } from "@/lib/trips";
import type { Row } from "@/lib/mappers";

/** Set my vote on a place in the plan: 1 = want to go, -1 = would skip, 0 = remove. Members with edit access only. */
export const PUT = handler<{ id: string; itemId: string }>(async (req, { params }) => {
  const u = await requireUser();
  const { id, itemId } = await params;
  await tripAccess(u.sb, id, u.id, "edit");
  const { value } = await parse(req, voteSchema);
  if (!must(await u.sb.from("trip_items").select("id").eq("id", itemId).eq("trip_id", id).maybeSingle())) throw new HttpError(404, "Item not found");
  if (value === 0) must(await u.sb.from("trip_item_votes").delete().eq("item_id", itemId).eq("user_id", u.id));
  else must(await u.sb.from("trip_item_votes").upsert({ item_id: itemId, user_id: u.id, value }));
  const votes = must(await u.sb.from("trip_item_votes").select("user_id, value").eq("item_id", itemId));
  return NextResponse.json({ votes: votes.map((v: Row) => ({ userId: v.user_id, value: v.value })) });
});

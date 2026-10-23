import { NextResponse } from "next/server";
import { handler, must, parse, requireUser, HttpError, type Db } from "@/lib/http";
import { commentSchema } from "@/lib/validators";
import { tripAccess } from "@/lib/trips";
import { commentOut } from "@/lib/mappers";

type P = { id: string; itemId: string };
const SELECT = "id, body, created_at, user_id, profiles(name)";

async function requireItem(sb: Db, tripId: string, itemId: string) {
  if (!must(await sb.from("trip_items").select("id").eq("id", itemId).eq("trip_id", tripId).maybeSingle())) throw new HttpError(404, "Item not found");
}

/** Everyone who can see the trip can read the discussion (oldest first). */
export const GET = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, itemId } = await params;
  await tripAccess(u.sb, id, u.id, "view");
  await requireItem(u.sb, id, itemId);
  const rows = must(await u.sb.from("trip_item_comments").select(SELECT).eq("item_id", itemId).order("created_at").limit(200));
  return NextResponse.json(rows.map(commentOut));
});

/** Members with edit access can comment. */
export const POST = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id, itemId } = await params;
  await tripAccess(u.sb, id, u.id, "edit");
  await requireItem(u.sb, id, itemId);
  const { body } = await parse(req, commentSchema);
  const row = must(await u.sb.from("trip_item_comments").insert({ item_id: itemId, user_id: u.id, body }).select(SELECT).single());
  return NextResponse.json(commentOut(row), { status: 201 });
});

import { NextResponse } from "next/server";
import { handler, must, requireUser, HttpError } from "@/lib/http";
import { tripAccess } from "@/lib/trips";

/** The author or the trip owner can delete a comment. */
export const DELETE = handler<{ id: string; commentId: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, commentId } = await params;
  const { role } = await tripAccess(u.sb, id, u.id, "view");
  const c = must(await u.sb.from("trip_item_comments").select("user_id, trip_items!inner(trip_id)").eq("id", commentId).eq("trip_items.trip_id", id).maybeSingle());
  if (!c) throw new HttpError(404, "Comment not found");
  if (c.user_id !== u.id && role !== "OWNER") throw new HttpError(403, "You can only delete your own comments");
  must(await u.sb.from("trip_item_comments").delete().eq("id", commentId));
  return NextResponse.json({ ok: true });
});

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireUser, HttpError } from "@/lib/http";
import { tripAccess } from "@/lib/trips";

/** The author or the trip owner can delete a comment. */
export const DELETE = handler<{ id: string; commentId: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, commentId } = await params;
  const { role } = await tripAccess(id, u.id, "view");
  const c = await db.tripItemComment.findFirst({ where: { id: commentId, item: { tripId: id } }, select: { userId: true } });
  if (!c) throw new HttpError(404, "Comment not found");
  if (c.userId !== u.id && role !== "OWNER") throw new HttpError(403, "You can only delete your own comments");
  await db.tripItemComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
});

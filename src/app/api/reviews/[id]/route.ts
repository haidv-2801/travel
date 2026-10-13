import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireUser, HttpError } from "@/lib/http";
import { refreshRating } from "@/lib/reviews";
import { deleteOwnImage } from "@/lib/storage";

/** Owner or admin can delete a review. */
export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const r = await db.review.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "Review not found");
  if (r.userId !== u.id && u.role !== "ADMIN") throw new HttpError(403, "Forbidden");
  await db.review.delete({ where: { id } });
  await refreshRating(r.destinationId);
  await deleteOwnImage(r.imageUrl, r.userId); // only ever deletes files in the review author's own folder
  return NextResponse.json({ ok: true });
});

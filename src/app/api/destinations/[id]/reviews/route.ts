import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser, HttpError } from "@/lib/http";
import { reviewSchema } from "@/lib/validators";
import { refreshRating } from "@/lib/reviews";
import { deleteOwnImage, ownObjectPath, reviewFolder } from "@/lib/storage";

type P = { id: string };

export const GET = handler<P>(async (req, { params }) => {
  const { id } = await params;
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1);
  const [items, total] = await Promise.all([
    db.review.findMany({ where: { destinationId: id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * 10, take: 10, include: { user: { select: { name: true } } } }),
    db.review.count({ where: { destinationId: id } }),
  ]);
  return NextResponse.json({ items, total, page });
});

/** Creates or updates the caller's review (one per user per destination). */
export const POST = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  if (!(await db.destination.findUnique({ where: { id } }))) throw new HttpError(404, "Destination not found");
  const data = await parse(req, reviewSchema);
  // A photo in our own bucket must be one this user uploaded (their folder), so nobody can attach or later delete someone else's file.
  const own = ownObjectPath(data.imageUrl);
  if (own && (!own.startsWith(reviewFolder(u.id)) || own.includes(".."))) throw new HttpError(400, "Image does not belong to you");
  const before = await db.review.findUnique({ where: { userId_destinationId: { userId: u.id, destinationId: id } }, select: { imageUrl: true } });
  const review = await db.review.upsert({
    where: { userId_destinationId: { userId: u.id, destinationId: id } },
    update: { ...data, imageUrl: data.imageUrl ?? null },
    create: { ...data, imageUrl: data.imageUrl ?? null, userId: u.id, destinationId: id },
  });
  await refreshRating(id);
  if (before?.imageUrl && before.imageUrl !== review.imageUrl) await deleteOwnImage(before.imageUrl, u.id); // replaced photo: free the old file
  return NextResponse.json(review, { status: 201 });
});

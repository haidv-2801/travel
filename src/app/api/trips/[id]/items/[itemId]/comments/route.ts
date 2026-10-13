import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser, HttpError } from "@/lib/http";
import { commentSchema } from "@/lib/validators";
import { tripAccess } from "@/lib/trips";

type P = { id: string; itemId: string };
const select = { id: true, body: true, createdAt: true, userId: true, user: { select: { name: true } } } as const;

async function requireItem(tripId: string, itemId: string) {
  if (!(await db.tripItem.findFirst({ where: { id: itemId, tripId }, select: { id: true } }))) throw new HttpError(404, "Item not found");
}

/** Everyone who can see the trip can read the discussion (oldest first). */
export const GET = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, itemId } = await params;
  await tripAccess(id, u.id, "view");
  await requireItem(id, itemId);
  return NextResponse.json(await db.tripItemComment.findMany({ where: { itemId }, orderBy: { createdAt: "asc" }, take: 200, select }));
});

/** Members with edit access can comment. */
export const POST = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id, itemId } = await params;
  await tripAccess(id, u.id, "edit");
  await requireItem(id, itemId);
  const { body } = await parse(req, commentSchema);
  return NextResponse.json(await db.tripItemComment.create({ data: { itemId, userId: u.id, body }, select }), { status: 201 });
});

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser, HttpError } from "@/lib/http";
import { voteSchema } from "@/lib/validators";
import { tripAccess } from "@/lib/trips";

/** Set my vote on a place in the plan: 1 = want to go, -1 = would skip, 0 = remove. Members with edit access only. */
export const PUT = handler<{ id: string; itemId: string }>(async (req, { params }) => {
  const u = await requireUser();
  const { id, itemId } = await params;
  await tripAccess(id, u.id, "edit");
  const { value } = await parse(req, voteSchema);
  if (!(await db.tripItem.findFirst({ where: { id: itemId, tripId: id }, select: { id: true } }))) throw new HttpError(404, "Item not found");
  if (value === 0) await db.tripItemVote.deleteMany({ where: { itemId, userId: u.id } });
  else await db.tripItemVote.upsert({ where: { itemId_userId: { itemId, userId: u.id } }, update: { value }, create: { itemId, userId: u.id, value } });
  return NextResponse.json({ votes: await db.tripItemVote.findMany({ where: { itemId }, select: { userId: true, value: true } }) });
});

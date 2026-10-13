import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireUser, HttpError } from "@/lib/http";
import { ownedTrip } from "@/lib/trips";

export const DELETE = handler<{ id: string; itemId: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, itemId } = await params;
  await ownedTrip(id, u.id);
  const r = await db.tripItem.deleteMany({ where: { id: itemId, tripId: id } });
  if (!r.count) throw new HttpError(404, "Item not found");
  return NextResponse.json({ ok: true });
});

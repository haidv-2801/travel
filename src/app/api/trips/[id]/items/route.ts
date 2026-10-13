import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser, HttpError } from "@/lib/http";
import { itemSchema, reorderSchema } from "@/lib/validators";
import { tripAccess, tripDays } from "@/lib/trips";

type P = { id: string };

export const POST = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { trip } = await tripAccess(id, u.id, "edit");
  const data = await parse(req, itemSchema);
  if (data.day > tripDays(trip.startDate, trip.endDate)) throw new HttpError(400, "Day is outside the trip");
  if (!(await db.destination.findUnique({ where: { id: data.destinationId } }))) throw new HttpError(404, "Destination not found");
  const last = await db.tripItem.aggregate({ where: { tripId: id, day: data.day }, _max: { position: true } });
  const item = await db.tripItem.create({
    data: { tripId: id, destinationId: data.destinationId, day: data.day, note: data.note ?? null, position: (last._max.position ?? -1) + 1 },
    include: { destination: { include: { category: true } } },
  });
  return NextResponse.json(item, { status: 201 });
});

/** Bulk reorder / move between days. Client sends the full desired layout. */
export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { trip } = await tripAccess(id, u.id, "edit");
  const { items } = await parse(req, reorderSchema);
  const days = tripDays(trip.startDate, trip.endDate);
  if (items.some((i) => i.day > days)) throw new HttpError(400, "Day is outside the trip");
  const owned = await db.tripItem.findMany({ where: { tripId: id, id: { in: items.map((i) => i.id) } }, select: { id: true } });
  if (owned.length !== new Set(items.map((i) => i.id)).size) throw new HttpError(400, "Unknown item");
  await db.$transaction(items.map((i) => db.tripItem.update({ where: { id: i.id }, data: { day: i.day, position: i.position } })));
  return NextResponse.json({ ok: true });
});

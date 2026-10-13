import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser, HttpError } from "@/lib/http";
import { tripUpdateSchema } from "@/lib/validators";
import { ownedTrip, tripDays } from "@/lib/trips";

type P = { id: string };

export const GET = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const trip = await db.trip.findFirst({
    where: { id, userId: u.id },
    include: {
      items: { include: { destination: { include: { category: true } } }, orderBy: [{ day: "asc" }, { position: "asc" }] },
      expenses: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!trip) throw new HttpError(404, "Trip not found");
  return NextResponse.json({ ...trip, days: tripDays(trip.startDate, trip.endDate) });
});

export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  await ownedTrip(id, u.id);
  const data = await parse(req, tripUpdateSchema);
  return NextResponse.json(await db.trip.update({ where: { id }, data }));
});

export const DELETE = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  await ownedTrip(id, u.id);
  await db.trip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});

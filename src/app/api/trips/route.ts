import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser } from "@/lib/http";
import { tripSchema } from "@/lib/validators";
import { accessibleTrips, tripDays } from "@/lib/trips";

export const GET = handler(async () => {
  const u = await requireUser();
  const trips = await db.trip.findMany({
    where: accessibleTrips(u.id),
    orderBy: { startDate: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json(trips.map((t) => ({ ...t, shared: t.userId !== u.id, days: tripDays(t.startDate, t.endDate) })));
});

export const POST = handler(async (req) => {
  const u = await requireUser();
  const data = await parse(req, tripSchema);
  const trip = await db.trip.create({
    data: { ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate), userId: u.id },
  });
  return NextResponse.json(trip, { status: 201 });
});

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireUser, HttpError } from "@/lib/http";
import { loadSharedTrip } from "@/lib/shared";

/** Copies a shared itinerary (not expenses) into the caller's account. */
export const POST = handler<{ token: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const src = await loadSharedTrip((await params).token);
  if (!src) throw new HttpError(404, "Not found");
  const copy = await db.trip.create({
    data: {
      title: `${src.title} (bản sao)`, startDate: src.startDate, endDate: src.endDate, budget: src.budget, userId: u.id,
      items: { create: src.items.map((i) => ({ destinationId: i.destination.id, day: i.day, position: i.position, note: i.note })) },
    },
  });
  return NextResponse.json({ id: copy.id }, { status: 201 });
});

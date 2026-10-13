import { db } from "./db";
import { HttpError } from "./http";

/** Loads a trip owned by the user or throws 404 (never leaks other users' trips). */
export async function ownedTrip(tripId: string, userId: string) {
  const trip = await db.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw new HttpError(404, "Trip not found");
  return trip;
}

export function tripDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

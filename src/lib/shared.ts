import { db } from "./db";
import { tripDays } from "./trips";

/** Public view of a shared trip. Never exposes owner email, budget actuals or notes of other data. */
export async function loadSharedTrip(token: string) {
  if (!token || token.length < 16) return null;
  const trip = await db.trip.findUnique({
    where: { shareToken: token },
    select: {
      id: true, title: true, startDate: true, endDate: true, budget: true,
      user: { select: { name: true } },
      items: { orderBy: [{ day: "asc" }, { position: "asc" }], select: { id: true, day: true, position: true, note: true, destination: { select: { id: true, name: true, slug: true, city: true, lat: true, lng: true, avgCost: true } } } },
    },
  });
  return trip && { ...trip, days: tripDays(trip.startDate, trip.endDate) };
}

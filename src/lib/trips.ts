import { db } from "./db";
import { HttpError } from "./http";

export type TripAccessRole = "OWNER" | "EDITOR" | "VIEWER";
export type Need = "view" | "edit" | "owner";

const RANK: Record<TripAccessRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };
const NEED: Record<Need, number> = { view: 1, edit: 2, owner: 3 };

/** Where-clause matching trips the user owns or is a member of. */
export const accessibleTrips = (userId: string) => ({ OR: [{ userId }, { members: { some: { userId } } }] });

/**
 * Loads a trip the user can access with at least the `need` level, or throws.
 * Trips the user cannot see at all are 404 (never leaks existence); insufficient role is 403.
 */
export async function tripAccess(tripId: string, userId: string, need: Need) {
  const trip = await db.trip.findFirst({
    where: { id: tripId, ...accessibleTrips(userId) },
    include: { members: { where: { userId }, select: { role: true } } },
  });
  if (!trip) throw new HttpError(404, "Trip not found");
  const role: TripAccessRole = trip.userId === userId ? "OWNER" : trip.members[0]?.role ?? "VIEWER";
  if (RANK[role] < NEED[need]) throw new HttpError(403, need === "owner" ? "Only the trip owner can do this" : "You have view-only access to this trip");
  return { trip, role };
}

/** Owner-only access (kept for callers that need the plain trip row). */
export async function ownedTrip(tripId: string, userId: string) {
  return (await tripAccess(tripId, userId, "owner")).trip;
}

export function tripDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Everyone who can take part in splitting costs: the owner plus all members. */
export async function tripParticipantIds(tripId: string, ownerId: string) {
  const members = await db.tripMember.findMany({ where: { tripId }, select: { userId: true } });
  return [ownerId, ...members.map((m) => m.userId)];
}

/** Throws 400 unless the payer and every sharer take part in the trip. */
export function assertParticipants(participants: string[], ids: (string | null | undefined)[]) {
  if (ids.some((id) => id && !participants.includes(id))) throw new HttpError(400, "Payer and sharers must be trip members");
}

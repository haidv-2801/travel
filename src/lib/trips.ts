import { HttpError, must, type Db } from "./http";
import { tripOut, type Row } from "./mappers";

export type TripAccessRole = "OWNER" | "EDITOR" | "VIEWER";
export type Need = "view" | "edit" | "owner";

const RANK: Record<TripAccessRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };
const NEED: Record<Need, number> = { view: 1, edit: 2, owner: 3 };

/**
 * Loads a trip the user can access with at least the `need` level, or throws.
 * Row Level Security only returns trips the user can see, so others are 404 (never leaks existence); insufficient role is 403.
 */
export async function tripAccess(sb: Db, tripId: string, userId: string, need: Need) {
  const { data, error } = await sb.from("trips").select("*, trip_members(user_id, role)").eq("id", tripId).maybeSingle();
  if (error && error.code !== "22P02") throw new Error(error.message);
  if (!data) throw new HttpError(404, "Trip not found");
  const row = data as Row;
  const role: TripAccessRole = row.owner_id === userId ? "OWNER" : (row.trip_members as Row[]).find((m: Row) => m.user_id === userId)?.role ?? "VIEWER";
  if (RANK[role] < NEED[need]) throw new HttpError(403, need === "owner" ? "Only the trip owner can do this" : "You have view-only access to this trip");
  return { trip: tripOut(row), role };
}

export function tripDays(start: string | Date, end: string | Date) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;
}

/** Everyone who can take part in splitting costs: the owner plus all members. */
export async function tripParticipantIds(sb: Db, tripId: string, ownerId: string) {
  const members = must(await sb.from("trip_members").select("user_id").eq("trip_id", tripId));
  return [ownerId, ...members.map((m: Row) => m.user_id as string)];
}

/** Throws 400 unless the payer and every sharer take part in the trip. */
export function assertParticipants(participants: string[], ids: (string | null | undefined)[]) {
  if (ids.some((id) => id && !participants.includes(id))) throw new HttpError(400, "Payer and sharers must be trip members");
}

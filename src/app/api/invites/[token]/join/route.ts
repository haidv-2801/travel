import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireUser, HttpError } from "@/lib/http";

/** Join a trip through its invite link. Idempotent: an existing member/owner keeps their current role. */
export const POST = handler<{ token: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { token } = await params;
  const trip = token.length >= 16 ? await db.trip.findUnique({ where: { inviteToken: token }, select: { id: true, userId: true, inviteRole: true } }) : null;
  if (!trip) throw new HttpError(404, "Invite link is invalid or has been turned off");
  if (trip.userId !== u.id) {
    await db.tripMember.createMany({ data: [{ tripId: trip.id, userId: u.id, role: trip.inviteRole }], skipDuplicates: true });
  }
  return NextResponse.json({ tripId: trip.id });
});

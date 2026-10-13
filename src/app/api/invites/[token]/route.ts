import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireUser, HttpError } from "@/lib/http";

/** Preview of an invite (so the user sees what they are joining). Signed-in users only. */
export const GET = handler<{ token: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { token } = await params;
  const trip = token.length >= 16 ? await db.trip.findUnique({
    where: { inviteToken: token },
    select: { id: true, title: true, startDate: true, endDate: true, inviteRole: true, userId: true, user: { select: { name: true } }, members: { where: { userId: u.id }, select: { role: true } } },
  }) : null;
  if (!trip) throw new HttpError(404, "Invite link is invalid or has been turned off");
  return NextResponse.json({
    tripId: trip.id, title: trip.title, startDate: trip.startDate, endDate: trip.endDate,
    owner: trip.user.name, role: trip.inviteRole, alreadyMember: trip.userId === u.id || trip.members.length > 0,
  });
});

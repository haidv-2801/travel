import { NextResponse } from "next/server";
import { handler, requireUser, HttpError, must } from "@/lib/http";

/** Preview of an invite (so the user sees what they are joining). Signed-in users only. */
export const GET = handler<{ token: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { token } = await params;
  const t = must(await u.sb.rpc("preview_invite", { p_token: token }))[0];
  if (!t) throw new HttpError(404, "Invite link is invalid or has been turned off");
  return NextResponse.json({
    tripId: t.trip_id, title: t.title, startDate: t.start_date, endDate: t.end_date, owner: t.owner_name, role: t.role, alreadyMember: t.already_member,
  });
});

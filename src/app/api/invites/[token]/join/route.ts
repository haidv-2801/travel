import { NextResponse } from "next/server";
import { handler, requireUser, HttpError } from "@/lib/http";

/** Join a trip through its invite link. Idempotent: an existing member/owner keeps their current role. */
export const POST = handler<{ token: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { token } = await params;
  const { data, error } = await u.sb.rpc("join_trip", { p_token: token });
  if (error?.code === "P0002") throw new HttpError(404, "Invite link is invalid or has been turned off");
  if (error) throw new Error(error.message);
  return NextResponse.json({ tripId: data });
});

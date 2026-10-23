import { NextResponse } from "next/server";
import { handler, must, parse, requireUser, HttpError } from "@/lib/http";
import { memberUpdateSchema } from "@/lib/validators";
import { tripAccess } from "@/lib/trips";

type P = { id: string; userId: string };

/** Owner changes a member's role. */
export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id, userId } = await params;
  await tripAccess(u.sb, id, u.id, "owner");
  const { role } = await parse(req, memberUpdateSchema);
  const r = must(await u.sb.from("trip_members").update({ role }).eq("trip_id", id).eq("user_id", userId).select("user_id"));
  if (!r.length) throw new HttpError(404, "Member not found");
  return NextResponse.json({ ok: true });
});

/** Owner removes a member, or a member leaves the trip themselves. */
export const DELETE = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, userId } = await params;
  await tripAccess(u.sb, id, u.id, userId === u.id ? "view" : "owner");
  // Also drops them from this trip's cost splitting and votes so nothing is left counted for someone who is gone.
  if (!must(await u.sb.rpc("remove_trip_member", { p_trip: id, p_user: userId }))) throw new HttpError(404, "Member not found");
  return NextResponse.json({ ok: true });
});

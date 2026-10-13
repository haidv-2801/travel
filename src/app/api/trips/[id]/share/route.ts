import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser } from "@/lib/http";
import { shareSchema } from "@/lib/validators";
import { ownedTrip } from "@/lib/trips";

/** Enable (generates an unguessable token) or disable public read-only sharing. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const trip = await ownedTrip(id, u.id);
  const { enabled } = await parse(req, shareSchema);
  const shareToken = enabled ? trip.shareToken ?? randomBytes(18).toString("base64url") : null;
  await db.trip.update({ where: { id }, data: { shareToken } });
  return NextResponse.json({ shareToken });
});

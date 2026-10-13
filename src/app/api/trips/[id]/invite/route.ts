import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser } from "@/lib/http";
import { inviteSchema } from "@/lib/validators";
import { tripAccess } from "@/lib/trips";

/** Owner enables (or re-issues with a new role) / disables the invite link. Disabling invalidates the old link; existing members stay. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { trip } = await tripAccess(id, u.id, "owner");
  const { enabled, role } = await parse(req, inviteSchema);
  const inviteToken = enabled ? trip.inviteToken ?? randomBytes(18).toString("base64url") : null;
  await db.trip.update({ where: { id }, data: { inviteToken, inviteRole: role } });
  return NextResponse.json({ inviteToken, inviteRole: role });
});

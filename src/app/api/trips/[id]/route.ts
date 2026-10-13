import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser } from "@/lib/http";
import { tripUpdateSchema } from "@/lib/validators";
import { tripAccess, tripDays } from "@/lib/trips";

type P = { id: string };

export const GET = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { role } = await tripAccess(id, u.id, "view");
  const trip = await db.trip.findUniqueOrThrow({
    where: { id },
    include: {
      items: { include: { destination: { include: { category: true } } }, orderBy: [{ day: "asc" }, { position: "asc" }] },
      expenses: { orderBy: { createdAt: "asc" } },
      user: { select: { id: true, name: true } },
      members: { orderBy: { createdAt: "asc" }, select: { userId: true, role: true, user: { select: { name: true, email: true } } } },
    },
  });
  // Invite link settings are only revealed to the owner.
  const { inviteToken, inviteRole, ...rest } = trip;
  return NextResponse.json({
    ...rest,
    myRole: role,
    ...(role === "OWNER" ? { inviteToken, inviteRole } : {}),
    days: tripDays(trip.startDate, trip.endDate),
  });
});

export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  await tripAccess(id, u.id, "edit");
  const data = await parse(req, tripUpdateSchema);
  return NextResponse.json(await db.trip.update({ where: { id }, data }));
});

export const DELETE = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  await tripAccess(id, u.id, "owner");
  await db.trip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});

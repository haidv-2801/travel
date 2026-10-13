import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser, HttpError } from "@/lib/http";
import { memberUpdateSchema } from "@/lib/validators";
import { tripAccess } from "@/lib/trips";

type P = { id: string; userId: string };

/** Owner changes a member's role. */
export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id, userId } = await params;
  await tripAccess(id, u.id, "owner");
  const { role } = await parse(req, memberUpdateSchema);
  const r = await db.tripMember.updateMany({ where: { tripId: id, userId }, data: { role } });
  if (!r.count) throw new HttpError(404, "Member not found");
  return NextResponse.json({ ok: true });
});

/** Owner removes a member, or a member leaves the trip themselves. */
export const DELETE = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, userId } = await params;
  await tripAccess(id, u.id, userId === u.id ? "view" : "owner");
  // Removing a member also drops them from this trip's cost splitting so no debt is left against someone who is gone.
  const r = await db.$transaction(async (tx) => {
    const del = await tx.tripMember.deleteMany({ where: { tripId: id, userId } });
    if (del.count) {
      await tx.expense.updateMany({ where: { tripId: id, paidById: userId }, data: { paidById: null } });
      await tx.expenseShare.deleteMany({ where: { userId, expense: { tripId: id } } });
    }
    return del;
  });
  if (!r.count) throw new HttpError(404, "Member not found");
  return NextResponse.json({ ok: true });
});

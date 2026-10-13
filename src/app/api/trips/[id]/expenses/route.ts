import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser } from "@/lib/http";
import { expenseSchema } from "@/lib/validators";
import { assertParticipants, tripAccess, tripParticipantIds } from "@/lib/trips";
import { expenseInclude, expenseOut, shareRows } from "@/lib/expenses";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { trip } = await tripAccess(id, u.id, "edit");
  const { splitAmong, shareAmounts, ...data } = await parse(req, expenseSchema);
  const shares = shareRows(splitAmong, shareAmounts, data.actual ?? 0);
  assertParticipants(await tripParticipantIds(id, trip.userId), [data.paidById, ...shares.map((s) => s.userId)]);
  const created = await db.expense.create({
    data: { ...data, tripId: id, shares: { create: shares } },
    include: expenseInclude,
  });
  return NextResponse.json(expenseOut(created), { status: 201 });
});

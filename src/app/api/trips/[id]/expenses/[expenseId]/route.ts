import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser, HttpError } from "@/lib/http";
import { expenseUpdateSchema } from "@/lib/validators";
import { assertParticipants, tripAccess, tripParticipantIds } from "@/lib/trips";
import { expenseInclude, expenseOut, shareRows } from "@/lib/expenses";

type P = { id: string; expenseId: string };

export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id, expenseId } = await params;
  const { trip } = await tripAccess(id, u.id, "edit");
  const { splitAmong, shareAmounts, ...data } = await parse(req, expenseUpdateSchema);
  const participants = await tripParticipantIds(id, trip.userId);
  assertParticipants(participants, [data.paidById, ...(splitAmong ?? []), ...Object.keys(shareAmounts ?? {})]);
  const ok = await db.$transaction(async (tx) => {
    // Look it up first: updateMany reports 0 rows when `data` is empty (e.g. only the split list changed).
    const current = await tx.expense.findFirst({ where: { id: expenseId, tripId: id }, include: { shares: true } });
    if (!current) return false;
    const actual = data.actual ?? current.actual;
    const wasExact = current.shares.length > 0 && current.shares.every((s) => s.amount !== null);
    if (wasExact && !splitAmong && !shareAmounts && actual !== current.actual) {
      throw new HttpError(400, "This expense has exact shares: send shareAmounts (or splitAmong to go back to an equal split) when changing the cost");
    }
    // Replace the shares when the client sent a new split; `shareAmounts: {}` or a plain splitAmong means an equal split.
    const rows = splitAmong || shareAmounts ? shareRows(splitAmong, shareAmounts, actual) : null;
    if (Object.keys(data).length) await tx.expense.update({ where: { id: expenseId }, data });
    if (rows) {
      await tx.expenseShare.deleteMany({ where: { expenseId } });
      await tx.expenseShare.createMany({ data: rows.map((r) => ({ expenseId, ...r })) });
    }
    return true;
  });
  if (!ok) throw new HttpError(404, "Expense not found");
  return NextResponse.json(expenseOut(await db.expense.findUniqueOrThrow({ where: { id: expenseId }, include: expenseInclude })));
});

export const DELETE = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, expenseId } = await params;
  await tripAccess(id, u.id, "edit");
  const r = await db.expense.deleteMany({ where: { id: expenseId, tripId: id } });
  if (!r.count) throw new HttpError(404, "Expense not found");
  return NextResponse.json({ ok: true });
});

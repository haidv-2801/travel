import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser, HttpError } from "@/lib/http";
import { expenseUpdateSchema } from "@/lib/validators";
import { assertParticipants, tripAccess, tripParticipantIds } from "@/lib/trips";
import { expenseInclude, expenseOut } from "@/lib/expenses";

type P = { id: string; expenseId: string };

export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id, expenseId } = await params;
  const { trip } = await tripAccess(id, u.id, "edit");
  const { splitAmong, ...data } = await parse(req, expenseUpdateSchema);
  assertParticipants(await tripParticipantIds(id, trip.userId), [data.paidById, ...(splitAmong ?? [])]);
  const ok = await db.$transaction(async (tx) => {
    // Look it up first: updateMany reports 0 rows when `data` is empty (e.g. only the split list changed).
    if (!(await tx.expense.findFirst({ where: { id: expenseId, tripId: id }, select: { id: true } }))) return false;
    if (Object.keys(data).length) await tx.expense.update({ where: { id: expenseId }, data });
    if (splitAmong) {
      await tx.expenseShare.deleteMany({ where: { expenseId } });
      await tx.expenseShare.createMany({ data: [...new Set(splitAmong)].map((userId) => ({ expenseId, userId })) });
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

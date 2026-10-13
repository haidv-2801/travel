import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser, HttpError } from "@/lib/http";
import { expenseUpdateSchema } from "@/lib/validators";
import { tripAccess } from "@/lib/trips";

type P = { id: string; expenseId: string };

export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id, expenseId } = await params;
  await tripAccess(id, u.id, "edit");
  const data = await parse(req, expenseUpdateSchema);
  const r = await db.expense.updateMany({ where: { id: expenseId, tripId: id }, data });
  if (!r.count) throw new HttpError(404, "Expense not found");
  return NextResponse.json(await db.expense.findUnique({ where: { id: expenseId } }));
});

export const DELETE = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, expenseId } = await params;
  await tripAccess(id, u.id, "edit");
  const r = await db.expense.deleteMany({ where: { id: expenseId, tripId: id } });
  if (!r.count) throw new HttpError(404, "Expense not found");
  return NextResponse.json({ ok: true });
});

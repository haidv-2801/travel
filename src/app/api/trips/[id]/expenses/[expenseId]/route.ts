import { NextResponse } from "next/server";
import { handler, must, parse, requireUser, HttpError } from "@/lib/http";
import { expenseUpdateSchema } from "@/lib/validators";
import { assertParticipants, tripAccess, tripParticipantIds } from "@/lib/trips";
import { expenseSelect, shareRows } from "@/lib/expenses";
import { expenseOut } from "@/lib/mappers";

type P = { id: string; expenseId: string };

export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id, expenseId } = await params;
  const { trip } = await tripAccess(u.sb, id, u.id, "edit");
  const { splitAmong, shareAmounts, paidById, ...data } = await parse(req, expenseUpdateSchema);
  assertParticipants(await tripParticipantIds(u.sb, id, trip.userId), [paidById, ...(splitAmong ?? []), ...Object.keys(shareAmounts ?? {})]);
  const current = must(await u.sb.from("expenses").select(expenseSelect).eq("id", expenseId).eq("trip_id", id).maybeSingle());
  if (!current) throw new HttpError(404, "Expense not found");
  const actual = data.actual ?? current.actual;
  const shares: { amount: number | null }[] = current.expense_shares;
  const wasExact = shares.length > 0 && shares.every((s) => s.amount !== null);
  if (wasExact && !splitAmong && !shareAmounts && actual !== current.actual) {
    throw new HttpError(400, "This expense has exact shares: send shareAmounts (or splitAmong to go back to an equal split) when changing the cost");
  }
  // Replace the shares when the client sent a new split; `shareAmounts: {}` or a plain splitAmong means an equal split.
  const rows = splitAmong || shareAmounts ? shareRows(splitAmong, shareAmounts, actual) : null;
  const patch = { ...data, ...(paidById !== undefined ? { paid_by: paidById } : {}) };
  if (Object.keys(patch).length) must(await u.sb.from("expenses").update(patch).eq("id", expenseId));
  if (rows) must(await u.sb.rpc("replace_expense_shares", { p_expense: expenseId, p_rows: rows }));
  return NextResponse.json(expenseOut(must(await u.sb.from("expenses").select(expenseSelect).eq("id", expenseId).single())));
});

export const DELETE = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id, expenseId } = await params;
  await tripAccess(u.sb, id, u.id, "edit");
  const r = must(await u.sb.from("expenses").delete().eq("id", expenseId).eq("trip_id", id).select("id"));
  if (!r.length) throw new HttpError(404, "Expense not found");
  return NextResponse.json({ ok: true });
});

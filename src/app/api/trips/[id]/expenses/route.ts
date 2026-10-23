import { NextResponse } from "next/server";
import { handler, must, parse, requireUser } from "@/lib/http";
import { expenseSchema } from "@/lib/validators";
import { assertParticipants, tripAccess, tripParticipantIds } from "@/lib/trips";
import { expenseSelect, shareRows } from "@/lib/expenses";
import { expenseOut } from "@/lib/mappers";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { trip } = await tripAccess(u.sb, id, u.id, "edit");
  const { splitAmong, shareAmounts, paidById, ...data } = await parse(req, expenseSchema);
  const shares = shareRows(splitAmong, shareAmounts, data.actual ?? 0);
  assertParticipants(await tripParticipantIds(u.sb, id, trip.userId), [paidById, ...shares.map((s) => s.user_id)]);
  const created = must(await u.sb.from("expenses").insert({ ...data, trip_id: id, paid_by: paidById ?? null }).select("id").single());
  if (shares.length) {
    const { error } = await u.sb.rpc("replace_expense_shares", { p_expense: created.id, p_rows: shares });
    if (error) {
      await u.sb.from("expenses").delete().eq("id", created.id);
      throw new Error(error.message);
    }
  }
  const row = must(await u.sb.from("expenses").select(expenseSelect).eq("id", created.id).single());
  return NextResponse.json(expenseOut(row), { status: 201 });
});

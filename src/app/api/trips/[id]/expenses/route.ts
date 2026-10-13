import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser } from "@/lib/http";
import { expenseSchema } from "@/lib/validators";
import { tripAccess } from "@/lib/trips";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  await tripAccess(id, u.id, "edit");
  const data = await parse(req, expenseSchema);
  return NextResponse.json(await db.expense.create({ data: { ...data, tripId: id } }), { status: 201 });
});

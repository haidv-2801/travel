import { NextResponse } from "next/server";
import { handler, must, parse, requireUser } from "@/lib/http";
import { tripUpdateSchema } from "@/lib/validators";
import { tripAccess, tripDays } from "@/lib/trips";
import { expenseOut, itemOut, tripOut } from "@/lib/mappers";

type P = { id: string };

const SELECT = `*,
  owner:profiles!owner_id(id, name),
  trip_members(user_id, role, created_at, profiles(name, email)),
  trip_items(*, destinations(*, categories(*)), trip_item_votes(user_id, value), trip_item_comments(count)),
  expenses(*, expense_shares(user_id, amount))`;

export const GET = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { role } = await tripAccess(u.sb, id, u.id, "view");
  const t = must(await u.sb.from("trips").select(SELECT).eq("id", id).single());
  const { inviteToken, inviteRole, ...rest } = tripOut(t); // invite link settings are only revealed to the owner
  return NextResponse.json({
    ...rest,
    user: { id: t.owner.id, name: t.owner.name },
    members: [...t.trip_members]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m: { user_id: string; role: string; profiles: { name: string; email: string } }) => ({ userId: m.user_id, role: m.role, user: { name: m.profiles.name, email: m.profiles.email } })),
    items: [...t.trip_items].sort((a, b) => a.day - b.day || a.position - b.position).map(itemOut),
    expenses: [...t.expenses].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(expenseOut),
    myRole: role,
    ...(role === "OWNER" ? { inviteToken, inviteRole } : {}),
    days: tripDays(t.start_date, t.end_date),
  });
});

export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  await tripAccess(u.sb, id, u.id, "edit");
  const data = await parse(req, tripUpdateSchema);
  return NextResponse.json(tripOut(must(await u.sb.from("trips").update(data).eq("id", id).select().single())));
});

export const DELETE = handler<P>(async (_req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  await tripAccess(u.sb, id, u.id, "owner");
  must(await u.sb.from("trips").delete().eq("id", id));
  return NextResponse.json({ ok: true });
});

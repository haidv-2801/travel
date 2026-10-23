import { NextResponse } from "next/server";
import { handler, must, parse, requireUser } from "@/lib/http";
import { tripSchema } from "@/lib/validators";
import { tripDays } from "@/lib/trips";
import { tripOut, type Row } from "@/lib/mappers";

export const GET = handler(async () => {
  const u = await requireUser();
  // RLS returns exactly the trips the user owns or belongs to.
  const trips = must(await u.sb.from("trips").select("*, trip_items(count)").order("start_date", { ascending: false }));
  return NextResponse.json(
    trips.map((t: Row) => ({ ...tripOut(t), _count: { items: t.trip_items[0]?.count ?? 0 }, shared: t.owner_id !== u.id, days: tripDays(t.start_date, t.end_date) })),
  );
});

export const POST = handler(async (req) => {
  const u = await requireUser();
  const data = await parse(req, tripSchema);
  const trip = must(
    await u.sb.from("trips").insert({ title: data.title, start_date: data.startDate, end_date: data.endDate, budget: data.budget, owner_id: u.id }).select().single(),
  );
  return NextResponse.json(tripOut(trip), { status: 201 });
});

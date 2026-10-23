import { NextResponse } from "next/server";
import { handler, must, parse, requireUser, HttpError } from "@/lib/http";
import { itemSchema, reorderSchema } from "@/lib/validators";
import { tripAccess, tripDays } from "@/lib/trips";
import { itemOut } from "@/lib/mappers";

type P = { id: string };

export const POST = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { trip } = await tripAccess(u.sb, id, u.id, "edit");
  const data = await parse(req, itemSchema);
  if (data.day > tripDays(trip.startDate, trip.endDate)) throw new HttpError(400, "Day is outside the trip");
  if (!must(await u.sb.from("destinations").select("id").eq("id", data.destinationId).maybeSingle())) throw new HttpError(404, "Destination not found");
  const last = must(await u.sb.from("trip_items").select("position").eq("trip_id", id).eq("day", data.day).order("position", { ascending: false }).limit(1));
  const item = must(
    await u.sb
      .from("trip_items")
      .insert({ trip_id: id, destination_id: data.destinationId, day: data.day, note: data.note ?? null, position: (last[0]?.position ?? -1) + 1 })
      .select("*, destinations(*, categories(*))")
      .single(),
  );
  return NextResponse.json(itemOut(item), { status: 201 });
});

/** Bulk reorder / move between days. Client sends the full desired layout. */
export const PATCH = handler<P>(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { trip } = await tripAccess(u.sb, id, u.id, "edit");
  const { items } = await parse(req, reorderSchema);
  const days = tripDays(trip.startDate, trip.endDate);
  if (items.some((i) => i.day > days)) throw new HttpError(400, "Day is outside the trip");
  const ids = [...new Set(items.map((i) => i.id))];
  const owned = ids.length ? must(await u.sb.from("trip_items").select("id").eq("trip_id", id).in("id", ids)) : [];
  if (owned.length !== ids.length) throw new HttpError(400, "Unknown item");
  must(await u.sb.rpc("reorder_trip_items", { p_trip: id, p_items: items }));
  return NextResponse.json({ ok: true });
});

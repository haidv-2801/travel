import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireAdmin, HttpError } from "@/lib/http";
import { destinationSchema } from "@/lib/validators";
import { normalize } from "@/lib/text";

type P = { id: string };

export const GET = handler<P>(async (_req, { params }) => {
  const { id } = await params;
  const d = await db.destination.findFirst({ where: { OR: [{ id }, { slug: id }] }, include: { category: true } });
  if (!d) throw new HttpError(404, "Not found");
  return NextResponse.json(d);
});

export const PATCH = handler<P>(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const data = await parse(req, destinationSchema.partial());
  const cur = await db.destination.findUnique({ where: { id } });
  if (!cur) throw new HttpError(404, "Not found");
  const searchText = normalize(`${data.name ?? cur.name} ${data.city ?? cur.city}`);
  return NextResponse.json(await db.destination.update({ where: { id }, data: { ...data, searchText } }));
});

export const DELETE = handler<P>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  if (await db.tripItem.findFirst({ where: { destinationId: id } })) throw new HttpError(409, "Destination is used in trips");
  try {
    await db.destination.delete({ where: { id } });
  } catch {
    throw new HttpError(404, "Not found");
  }
  return NextResponse.json({ ok: true });
});

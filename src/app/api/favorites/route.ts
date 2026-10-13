import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireUser, HttpError } from "@/lib/http";
import { favoriteSchema } from "@/lib/validators";

export const GET = handler(async () => {
  const u = await requireUser();
  const favs = await db.favorite.findMany({
    where: { userId: u.id },
    orderBy: { createdAt: "desc" },
    include: { destination: { include: { category: true } } },
  });
  return NextResponse.json(favs.map((f) => f.destination));
});

export const POST = handler(async (req) => {
  const u = await requireUser();
  const { destinationId } = await parse(req, favoriteSchema);
  if (!(await db.destination.findUnique({ where: { id: destinationId } }))) throw new HttpError(404, "Destination not found");
  await db.favorite.upsert({
    where: { userId_destinationId: { userId: u.id, destinationId } },
    update: {},
    create: { userId: u.id, destinationId },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});

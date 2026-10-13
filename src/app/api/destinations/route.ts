import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handler, parse, requireAdmin, HttpError } from "@/lib/http";
import { destinationSchema } from "@/lib/validators";
import { normalize } from "@/lib/text";

export const GET = handler(async (req) => {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize")) || 12));
  const where: Prisma.DestinationWhereInput = {
    ...(q && { searchText: { contains: normalize(q) } }),
    ...(sp.get("region") && { region: sp.get("region")! }),
    ...(sp.get("category") && { category: { slug: sp.get("category")! } }),
    ...(sp.get("maxCost") && { avgCost: { lte: Number(sp.get("maxCost")) || 0 } }),
  };
  const [items, total] = await Promise.all([
    db.destination.findMany({
      where,
      include: { category: true },
      orderBy: [{ rating: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.destination.count({ where }),
  ]);
  return NextResponse.json({ items, total, page, pageSize });
});

export const POST = handler(async (req) => {
  await requireAdmin();
  const data = await parse(req, destinationSchema);
  if (await db.destination.findUnique({ where: { slug: data.slug } })) throw new HttpError(409, "Slug already exists");
  return NextResponse.json(await db.destination.create({ data: { ...data, searchText: normalize(`${data.name} ${data.city}`) } }), { status: 201 });
});

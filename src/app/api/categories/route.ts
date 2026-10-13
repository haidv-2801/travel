import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parse, requireAdmin, HttpError } from "@/lib/http";
import { categorySchema } from "@/lib/validators";

export const GET = handler(async () => NextResponse.json(await db.category.findMany({ orderBy: { name: "asc" } })));

export const POST = handler(async (req) => {
  await requireAdmin();
  const data = await parse(req, categorySchema);
  if (await db.category.findFirst({ where: { OR: [{ slug: data.slug }, { name: data.name }] } }))
    throw new HttpError(409, "Category already exists");
  return NextResponse.json(await db.category.create({ data }), { status: 201 });
});

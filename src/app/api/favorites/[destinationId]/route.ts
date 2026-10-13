import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireUser } from "@/lib/http";

export const DELETE = handler<{ destinationId: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { destinationId } = await params;
  await db.favorite.deleteMany({ where: { userId: u.id, destinationId } });
  return NextResponse.json({ ok: true });
});

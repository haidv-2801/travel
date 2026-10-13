import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireAdmin } from "@/lib/http";

export const GET = handler(async () => {
  await requireAdmin();
  return NextResponse.json(
    await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, role: true, createdAt: true, _count: { select: { trips: true } } },
    }),
  );
});

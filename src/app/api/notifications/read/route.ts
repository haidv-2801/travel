import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireUser } from "@/lib/http";

export const POST = handler(async () => {
  const u = await requireUser();
  await db.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
});

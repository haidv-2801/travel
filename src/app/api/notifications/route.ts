import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireUser } from "@/lib/http";
import { generateReminders } from "@/lib/notifications";

export const GET = handler(async () => {
  const u = await requireUser();
  await generateReminders(u.id);
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.notification.count({ where: { userId: u.id, readAt: null } }),
  ]);
  return NextResponse.json({ items, unread });
});

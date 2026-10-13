import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, parse, requireAdmin, HttpError } from "@/lib/http";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { role } = await parse(req, z.object({ role: z.enum(["USER", "ADMIN"]) }));
  if (id === admin.id) throw new HttpError(400, "Cannot change your own role");
  try {
    const u = await db.user.update({ where: { id }, data: { role }, select: { id: true, role: true } });
    return NextResponse.json(u);
  } catch {
    throw new HttpError(404, "User not found");
  }
});

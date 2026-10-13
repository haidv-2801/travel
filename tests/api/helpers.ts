import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signToken, COOKIE } from "@/lib/auth";

export const prisma = new PrismaClient();

import { jar } from "./setup";

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "Notification","Review","Favorite","Expense","TripItem","Trip","Destination","Category","User" RESTART IDENTITY CASCADE`,
  );
  jar.clear();
}

export async function makeUser(email: string, role: "USER" | "ADMIN" = "USER") {
  return prisma.user.create({ data: { email, name: email.split("@")[0], role, passwordHash: await bcrypt.hash("password123", 4) } });
}

/** Acts as this user (or anonymous when null) for subsequent calls. */
export async function actAs(user: { id: string; role: "USER" | "ADMIN" } | null) {
  if (!user) jar.delete(COOKIE);
  else jar.set(COOKIE, await signToken({ id: user.id, role: user.role }));
}

export async function makeDestination(slug: string, over: Record<string, unknown> = {}) {
  const category = (await prisma.category.findFirst()) ?? (await prisma.category.create({ data: { name: "Biển", slug: "bien" } }));
  return prisma.destination.create({
    data: { name: slug, slug, description: "d", city: "Đà Lạt", region: "Tây Nguyên", lat: 11.94, lng: 108.45, avgCost: 100000, categoryId: category.id, searchText: slug, ...over },
  });
}

let ipCounter = 0;
/** Calls a route handler like Next would. Each call gets a fresh IP so the rate limiter never interferes. */
export async function call(
  route: (req: Request, ctx: { params: Promise<never> }) => Promise<Response>,
  method: string,
  url: string,
  opts: { body?: unknown; params?: Record<string, string> } = {},
) {
  const req = new Request(`http://test${url}`, {
    method,
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}` },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await route(req, { params: Promise.resolve((opts.params ?? {}) as never) });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { actAs, call, makeUser, prisma, resetDb } from "./helpers";
import { GET as cronGet, POST as cronPost } from "@/app/api/cron/reminders/route";
import { GET as listNotes } from "@/app/api/notifications/route";

type U = Awaited<ReturnType<typeof makeUser>>;
let owner: U, friend: U, viewer: U, stranger: U, tripId: string;
const day = (n: number) => new Date(Date.now() + n * 86_400_000);
const run = (secret?: string, route = cronPost) => {
  const req = new Request("http://test/api/cron/reminders", { method: route === cronPost ? "POST" : "GET", headers: { "x-forwarded-for": `7.7.7.${Math.floor(Math.random() * 250)}`, ...(secret ? { authorization: `Bearer ${secret}` } : {}) } });
  return route(req, { params: Promise.resolve({}) }).then(async (r) => ({ status: r.status, json: await r.json() }));
};

beforeEach(async () => {
  await resetDb();
  process.env.CRON_SECRET = "cron-secret-cron-secret";
  [owner, friend, viewer, stranger] = [await makeUser("o@x.com"), await makeUser("f@x.com"), await makeUser("v@x.com"), await makeUser("s@x.com")];
  tripId = (await prisma.trip.create({
    data: { title: "Đà Nẵng", startDate: day(1), endDate: day(3), userId: owner.id, members: { create: [{ userId: friend.id, role: "EDITOR" }, { userId: viewer.id, role: "VIEWER" }] } },
  })).id;
});
afterEach(() => { delete process.env.CRON_SECRET; });

describe("background reminder job", () => {
  it("is protected: disabled without a secret, 401 for a missing or wrong one", async () => {
    delete process.env.CRON_SECRET;
    expect((await run("anything")).status).toBe(503);
    process.env.CRON_SECRET = "cron-secret-cron-secret";
    expect((await run()).status).toBe(401);
    expect((await run("wrong-secret-wrong-secre")).status).toBe(401);
    expect((await run("short")).status).toBe(401);
    expect(await prisma.notification.count()).toBe(0);
  });

  it("creates a reminder for the owner and every member, but not for outsiders, via POST or GET", async () => {
    const r = await run("cron-secret-cron-secret");
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ trips: 1, created: 3 });
    const owners = (await prisma.notification.findMany({ select: { userId: true } })).map((n) => n.userId).sort();
    expect(owners).toEqual([owner.id, friend.id, viewer.id].sort());
    expect(owners).not.toContain(stranger.id);
    expect((await run("cron-secret-cron-secret", cronGet)).json.created).toBe(0); // GET (Vercel Cron) works and is idempotent
  });

  it("is idempotent and ignores trips that are far away or already over", async () => {
    await run("cron-secret-cron-secret");
    expect((await run("cron-secret-cron-secret")).json.created).toBe(0);
    await prisma.trip.create({ data: { title: "Far", startDate: day(30), endDate: day(31), userId: owner.id } });
    await prisma.trip.create({ data: { title: "Old", startDate: day(-10), endDate: day(-8), userId: owner.id } });
    expect((await run("cron-secret-cron-secret")).json).toEqual({ trips: 1, created: 0 });
  });

  it("does not duplicate what the lazy per-user path already created, and members get it lazily too", async () => {
    await actAs(friend);
    expect((await call(listNotes, "GET", "/x")).json.items).toHaveLength(1); // member sees reminder for a shared trip
    expect((await run("cron-secret-cron-secret")).json.created).toBe(2); // only owner + viewer were missing
    await actAs(stranger);
    expect((await call(listNotes, "GET", "/x")).json.items).toHaveLength(0);
  });
});

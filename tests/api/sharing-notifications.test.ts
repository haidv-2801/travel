import { beforeEach, describe, expect, it } from "vitest";
import { actAs, call, makeDestination, makeUser, prisma, resetDb } from "./helpers";
import { POST as share } from "@/app/api/trips/[id]/share/route";
import { GET as getShared } from "@/app/api/shared/[token]/route";
import { POST as clone } from "@/app/api/shared/[token]/clone/route";
import { GET as listNotes } from "@/app/api/notifications/route";
import { POST as markRead } from "@/app/api/notifications/read/route";
import { GET as route } from "@/app/api/route/route";

let owner: Awaited<ReturnType<typeof makeUser>>, other: typeof owner, tripId: string;
const day = (n: number) => new Date(Date.now() + n * 86_400_000);

beforeEach(async () => {
  await resetDb();
  owner = await makeUser("owner@x.com"); other = await makeUser("other@x.com");
  const d = await makeDestination("hoi-an");
  const t = await prisma.trip.create({
    data: {
      title: "Chuyến A", startDate: day(1), endDate: day(3), budget: 5_000_000, userId: owner.id,
      items: { create: [{ destinationId: d.id, day: 1, position: 0, note: "private note?" }] },
      expenses: { create: [{ title: "Secret expense", category: "food", planned: 1, actual: 999 }] },
    },
  });
  tripId = t.id;
  await actAs(owner);
});

describe("sharing", () => {
  it("only the owner can toggle; token is unguessable and stable while enabled", async () => {
    await actAs(other);
    expect((await call(share, "POST", "/x", { params: { id: tripId }, body: { enabled: true } })).status).toBe(404);
    await actAs(owner);
    const t1 = (await call(share, "POST", "/x", { params: { id: tripId }, body: { enabled: true } })).json.shareToken;
    const t2 = (await call(share, "POST", "/x", { params: { id: tripId }, body: { enabled: true } })).json.shareToken;
    expect(t1).toHaveLength(24);
    expect(t2).toBe(t1);
  });

  it("public view works anonymously, hides private data, and dies when disabled", async () => {
    const token = (await call(share, "POST", "/x", { params: { id: tripId }, body: { enabled: true } })).json.shareToken;
    await actAs(null);
    const r = await call(getShared, "GET", "/x", { params: { token } });
    expect(r.status).toBe(200);
    const s = JSON.stringify(r.json);
    for (const leak of ["owner@x.com", "Secret expense", "999", "passwordHash", token, owner.id]) expect(s).not.toContain(leak);
    await actAs(owner);
    await call(share, "POST", "/x", { params: { id: tripId }, body: { enabled: false } });
    expect((await call(getShared, "GET", "/x", { params: { token } })).status).toBe(404);
    // re-enabling issues a NEW token, so the old leaked link stays dead
    const t3 = (await call(share, "POST", "/x", { params: { id: tripId }, body: { enabled: true } })).json.shareToken;
    expect(t3).not.toBe(token);
  });

  it("rejects short/garbage tokens", async () => {
    for (const token of ["", "short", "a".repeat(15)]) expect((await call(getShared, "GET", "/x", { params: { token } })).status).toBe(404);
  });

  it("clone requires login, copies items but not expenses, and belongs to the cloner", async () => {
    const token = (await call(share, "POST", "/x", { params: { id: tripId }, body: { enabled: true } })).json.shareToken;
    await actAs(null);
    expect((await call(clone, "POST", "/x", { params: { token } })).status).toBe(401);
    await actAs(other);
    const r = await call(clone, "POST", "/x", { params: { token } });
    expect(r.status).toBe(201);
    const copy = await prisma.trip.findUniqueOrThrow({ where: { id: r.json.id }, include: { items: true, expenses: true } });
    expect(copy.userId).toBe(other.id);
    expect(copy.shareToken).toBeNull();
    expect(copy.items).toHaveLength(1);
    expect(copy.expenses).toHaveLength(0);
  });
});

describe("notifications", () => {
  it("creates a reminder for a trip starting soon, once, and scopes it to the owner", async () => {
    const first = (await call(listNotes, "GET", "/x")).json;
    expect(first.items).toHaveLength(1);
    expect(first.items[0].title).toContain("Chuyến A");
    expect(first.unread).toBe(1);
    expect((await call(listNotes, "GET", "/x")).json.items).toHaveLength(1); // idempotent
    await actAs(other);
    expect((await call(listNotes, "GET", "/x")).json.items).toHaveLength(0);
  });
  it("no reminder for far-away or past trips", async () => {
    await prisma.trip.update({ where: { id: tripId }, data: { startDate: day(30), endDate: day(32) } });
    expect((await call(listNotes, "GET", "/x")).json.items).toHaveLength(0);
    await prisma.trip.update({ where: { id: tripId }, data: { startDate: day(-10), endDate: day(-8) } });
    expect((await call(listNotes, "GET", "/x")).json.items).toHaveLength(0);
  });
  it("mark-as-read only affects the caller", async () => {
    await call(listNotes, "GET", "/x");
    await actAs(other);
    await call(listNotes, "GET", "/x");
    await call(markRead, "POST", "/x");
    await actAs(owner);
    expect((await call(listNotes, "GET", "/x")).json.unread).toBe(1);
    await call(markRead, "POST", "/x");
    expect((await call(listNotes, "GET", "/x")).json.unread).toBe(0);
  });
});

describe("route proxy input validation", () => {
  it("requires login and 2–25 valid lat,lng pairs", async () => {
    await actAs(null);
    expect((await call(route, "GET", "/api/route?points=1,2;3,4")).status).toBe(401);
    await actAs(owner);
    for (const bad of ["", "1,2", "1,2;abc,def", "91,0;0,0", "0,181;0,0", "1,2,3;4,5,6", Array(26).fill("1,2").join(";")])
      expect((await call(route, "GET", `/api/route?points=${bad}`)).status, bad).toBe(400);
  });
});

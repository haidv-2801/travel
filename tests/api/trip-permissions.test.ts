import { beforeEach, describe, expect, it } from "vitest";
import { actAs, call, makeDestination, makeUser, prisma, resetDb } from "./helpers";
import { GET as listTrips, POST as createTrip } from "@/app/api/trips/route";
import { DELETE as delTrip, GET as getTrip, PATCH as patchTrip } from "@/app/api/trips/[id]/route";
import { PATCH as reorder, POST as addItem } from "@/app/api/trips/[id]/items/route";
import { DELETE as delItem } from "@/app/api/trips/[id]/items/[itemId]/route";
import { POST as addExpense } from "@/app/api/trips/[id]/expenses/route";
import { DELETE as delExpense, PATCH as patchExpense } from "@/app/api/trips/[id]/expenses/[expenseId]/route";

let owner: Awaited<ReturnType<typeof makeUser>>, other: typeof owner, dest: Awaited<ReturnType<typeof makeDestination>>, tripId: string;

beforeEach(async () => {
  await resetDb();
  owner = await makeUser("owner@x.com");
  other = await makeUser("other@x.com");
  dest = await makeDestination("hoi-an");
  await actAs(owner);
  const r = await call(createTrip, "POST", "/api/trips", { body: { title: "T", startDate: "2026-12-01", endDate: "2026-12-03", budget: 1000000 } });
  expect(r.status).toBe(201);
  tripId = r.json.id;
});

describe("trip basics", () => {
  it("requires authentication", async () => {
    await actAs(null);
    expect((await call(listTrips, "GET", "/api/trips")).status).toBe(401);
    expect((await call(createTrip, "POST", "/api/trips", { body: {} })).status).toBe(401);
  });

  it("lists only my trips with computed day count", async () => {
    await actAs(other);
    await call(createTrip, "POST", "/x", { body: { title: "Theirs", startDate: "2026-01-01", endDate: "2026-01-01" } });
    await actAs(owner);
    const r = await call(listTrips, "GET", "/x");
    expect(r.json.map((t: { title: string }) => t.title)).toEqual(["T"]);
    expect(r.json[0].days).toBe(3);
  });

  it("validates dates", async () => {
    const r = await call(createTrip, "POST", "/x", { body: { title: "Bad", startDate: "2026-12-05", endDate: "2026-12-01" } });
    expect(r.status).toBe(400);
  });
});

describe("items", () => {
  it("assigns increasing positions within a day and rejects days outside the trip", async () => {
    const a = await call(addItem, "POST", "/x", { params: { id: tripId }, body: { destinationId: dest.id, day: 1 } });
    const b = await call(addItem, "POST", "/x", { params: { id: tripId }, body: { destinationId: dest.id, day: 1 } });
    expect([a.json.position, b.json.position]).toEqual([0, 1]);
    expect((await call(addItem, "POST", "/x", { params: { id: tripId }, body: { destinationId: dest.id, day: 4 } })).status).toBe(400);
    expect((await call(addItem, "POST", "/x", { params: { id: tripId }, body: { destinationId: "nope", day: 1 } })).status).toBe(404);
  });

  it("reorders and moves between days in one transaction", async () => {
    const a = (await call(addItem, "POST", "/x", { params: { id: tripId }, body: { destinationId: dest.id, day: 1 } })).json;
    const b = (await call(addItem, "POST", "/x", { params: { id: tripId }, body: { destinationId: dest.id, day: 1 } })).json;
    const r = await call(reorder, "PATCH", "/x", { params: { id: tripId }, body: { items: [{ id: b.id, day: 2, position: 0 }, { id: a.id, day: 1, position: 0 }] } });
    expect(r.status).toBe(200);
    const t = (await call(getTrip, "GET", "/x", { params: { id: tripId } })).json;
    expect(t.items.map((i: { id: string; day: number }) => [i.id, i.day])).toEqual([[a.id, 1], [b.id, 2]]);
  });

  it("reorder rejects unknown items and days outside the trip, changing nothing", async () => {
    const a = (await call(addItem, "POST", "/x", { params: { id: tripId }, body: { destinationId: dest.id, day: 1 } })).json;
    expect((await call(reorder, "PATCH", "/x", { params: { id: tripId }, body: { items: [{ id: a.id, day: 2, position: 0 }, { id: "ghost", day: 1, position: 1 }] } })).status).toBe(400);
    expect((await call(reorder, "PATCH", "/x", { params: { id: tripId }, body: { items: [{ id: a.id, day: 9, position: 0 }] } })).status).toBe(400);
    expect((await prisma.tripItem.findUniqueOrThrow({ where: { id: a.id } })).day).toBe(1);
  });
});

describe("cross-user access (IDOR)", () => {
  let itemId: string, expenseId: string;
  beforeEach(async () => {
    itemId = (await call(addItem, "POST", "/x", { params: { id: tripId }, body: { destinationId: dest.id, day: 1 } })).json.id;
    expenseId = (await call(addExpense, "POST", "/x", { params: { id: tripId }, body: { title: "Bay", category: "transport", planned: 100, actual: 90 } })).json.id;
    await actAs(other);
  });

  it("other users get 404 (not 403) on every trip endpoint", async () => {
    const p = { id: tripId };
    expect((await call(getTrip, "GET", "/x", { params: p })).status).toBe(404);
    expect((await call(patchTrip, "PATCH", "/x", { params: p, body: { title: "pwned" } })).status).toBe(404);
    expect((await call(delTrip, "DELETE", "/x", { params: p })).status).toBe(404);
    expect((await call(addItem, "POST", "/x", { params: p, body: { destinationId: dest.id, day: 1 } })).status).toBe(404);
    expect((await call(reorder, "PATCH", "/x", { params: p, body: { items: [{ id: itemId, day: 2, position: 0 }] } })).status).toBe(404);
    expect((await call(delItem, "DELETE", "/x", { params: { ...p, itemId } })).status).toBe(404);
    expect((await call(addExpense, "POST", "/x", { params: p, body: { title: "x", category: "food" } })).status).toBe(404);
    expect((await call(patchExpense, "PATCH", "/x", { params: { ...p, expenseId }, body: { actual: 0 } })).status).toBe(404);
    expect((await call(delExpense, "DELETE", "/x", { params: { ...p, expenseId } })).status).toBe(404);
  });

  it("nothing was modified by the failed attempts", async () => {
    await call(patchTrip, "PATCH", "/x", { params: { id: tripId }, body: { title: "pwned" } });
    await call(delTrip, "DELETE", "/x", { params: { id: tripId } });
    const t = await prisma.trip.findUniqueOrThrow({ where: { id: tripId }, include: { items: true, expenses: true } });
    expect(t.title).toBe("T");
    expect(t.items).toHaveLength(1);
    expect(t.expenses[0].actual).toBe(90);
  });

  it("cannot reach my item/expense by routing it through the attacker's own trip", async () => {
    const mine = (await call(createTrip, "POST", "/x", { body: { title: "Mine", startDate: "2026-12-01", endDate: "2026-12-02" } })).json.id;
    expect((await call(delItem, "DELETE", "/x", { params: { id: mine, itemId } })).status).toBe(404);
    expect((await call(patchExpense, "PATCH", "/x", { params: { id: mine, expenseId }, body: { actual: 0 } })).status).toBe(404);
    expect((await call(delExpense, "DELETE", "/x", { params: { id: mine, expenseId } })).status).toBe(404);
    expect((await call(reorder, "PATCH", "/x", { params: { id: mine }, body: { items: [{ id: itemId, day: 1, position: 0 }] } })).status).toBe(400);
    expect(await prisma.tripItem.count()).toBe(1);
    expect(await prisma.expense.count()).toBe(1);
  });
});

describe("expenses", () => {
  it("creates, updates and deletes; rejects bad input", async () => {
    const e = await call(addExpense, "POST", "/x", { params: { id: tripId }, body: { title: "Ăn", category: "food", planned: 50000 } });
    expect(e.status).toBe(201);
    const u = await call(patchExpense, "PATCH", "/x", { params: { id: tripId, expenseId: e.json.id }, body: { actual: 70000 } });
    expect(u.json).toMatchObject({ planned: 50000, actual: 70000 });
    expect((await call(addExpense, "POST", "/x", { params: { id: tripId }, body: { title: "x", category: "bogus" } })).status).toBe(400);
    expect((await call(delExpense, "DELETE", "/x", { params: { id: tripId, expenseId: e.json.id } })).status).toBe(200);
  });
});

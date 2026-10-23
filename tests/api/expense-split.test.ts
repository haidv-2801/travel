import { beforeEach, describe, expect, it } from "vitest";
import { actAs, call, makeUser, prisma, resetDb } from "./helpers";
import { GET as getTrip } from "@/app/api/trips/[id]/route";
import { POST as addExpense } from "@/app/api/trips/[id]/expenses/route";
import { PATCH as patchExpense } from "@/app/api/trips/[id]/expenses/[expenseId]/route";
import { DELETE as delMember } from "@/app/api/trips/[id]/members/[userId]/route";

type U = Awaited<ReturnType<typeof makeUser>>;
let owner: U, friend: U, viewer: U, stranger: U, tripId: string;
const p = () => ({ id: tripId });
const body = (over: object = {}) => ({ title: "Khách sạn", category: "lodging", planned: 0, actual: 900_000, ...over });

beforeEach(async () => {
  await resetDb();
  [owner, friend, viewer, stranger] = [await makeUser("o@x.com"), await makeUser("f@x.com"), await makeUser("v@x.com"), await makeUser("s@x.com")];
  tripId = (await prisma.trip.create({ data: { title: "T", startDate: new Date("2026-12-01"), endDate: new Date("2026-12-03"), userId: owner.id } })).id;
  await prisma.tripMember.createMany({ data: [{ tripId, userId: friend.id, role: "EDITOR" }, { tripId, userId: viewer.id, role: "VIEWER" }] });
  await actAs(owner);
});

describe("expense payer and split", () => {
  it("stores the payer and who it is split between, and returns them with the trip", async () => {
    const r = await call(addExpense, "POST", "/x", { params: p(), body: body({ paidById: friend.id, splitAmong: [owner.id, friend.id] }) });
    expect(r.status).toBe(201);
    expect(r.json.paidById).toBe(friend.id);
    expect(r.json.splitAmong.sort()).toEqual([owner.id, friend.id].sort());
    const t = (await call(getTrip, "GET", "/x", { params: p() })).json;
    expect(t.expenses[0]).toMatchObject({ paidById: friend.id });
    expect(t.expenses[0].splitAmong).toHaveLength(2);
    expect(t.expenses[0]).not.toHaveProperty("shares");
  });

  it("splitting is optional: a plain expense still works with everyone as default", async () => {
    const r = await call(addExpense, "POST", "/x", { params: p(), body: body() });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ paidById: null, splitAmong: [] });
  });

  it("rejects a payer or sharer who is not in the trip", async () => {
    expect((await call(addExpense, "POST", "/x", { params: p(), body: body({ paidById: stranger.id }) })).status).toBe(400);
    expect((await call(addExpense, "POST", "/x", { params: p(), body: body({ paidById: owner.id, splitAmong: [stranger.id] }) })).status).toBe(400);
    expect(await prisma.expense.count()).toBe(0);
  });

  it("patch replaces the split list, can clear the payer, and rejects outsiders without changing anything", async () => {
    const id = (await call(addExpense, "POST", "/x", { params: p(), body: body({ paidById: owner.id, splitAmong: [owner.id, friend.id] }) })).json.id;
    const ok = await call(patchExpense, "PATCH", "/x", { params: { ...p(), expenseId: id }, body: { splitAmong: [friend.id] } });
    expect(ok.json.splitAmong).toEqual([friend.id]);
    expect((await call(patchExpense, "PATCH", "/x", { params: { ...p(), expenseId: id }, body: { splitAmong: [stranger.id] } })).status).toBe(400);
    expect((await prisma.expenseShare.findMany({ where: { expenseId: id } })).map((s) => s.userId)).toEqual([friend.id]);
    expect((await call(patchExpense, "PATCH", "/x", { params: { ...p(), expenseId: id }, body: { paidById: null } })).json.paidById).toBeNull();
  });

  it("viewers cannot record or change who paid", async () => {
    const id = (await call(addExpense, "POST", "/x", { params: p(), body: body({ paidById: owner.id }) })).json.id;
    await actAs(viewer);
    expect((await call(addExpense, "POST", "/x", { params: p(), body: body({ paidById: viewer.id }) })).status).toBe(403);
    expect((await call(patchExpense, "PATCH", "/x", { params: { ...p(), expenseId: id }, body: { paidById: viewer.id } })).status).toBe(403);
    expect((await prisma.expense.findUniqueOrThrow({ where: { id } })).paidById).toBe(owner.id);
  });

  it("removing a member clears them as payer and sharer on this trip only", async () => {
    const e = (await call(addExpense, "POST", "/x", { params: p(), body: body({ paidById: friend.id, splitAmong: [owner.id, friend.id] }) })).json.id;
    const other = await prisma.trip.create({ data: { title: "Other", startDate: new Date("2026-12-01"), endDate: new Date("2026-12-01"), userId: owner.id, members: { create: { userId: friend.id } } } });
    const e2 = await prisma.expense.create({ data: { tripId: other.id, title: "x", category: "food", actual: 10, paidById: friend.id, shares: { create: { userId: friend.id } } } });
    expect((await call(delMember, "DELETE", "/x", { params: { ...p(), userId: friend.id } })).status).toBe(200);
    const after = await prisma.expense.findUniqueOrThrow({ where: { id: e }, include: { shares: true } });
    expect(after.paidById).toBeNull();
    expect(after.shares.map((s) => s.userId)).toEqual([owner.id]);
    const untouched = await prisma.expense.findUniqueOrThrow({ where: { id: e2.id }, include: { shares: true } });
    expect(untouched.paidById).toBe(friend.id);
    expect(untouched.shares).toHaveLength(1);
  });

  describe("exact (uneven) shares", () => {
    const exact = (over: object = {}) => body({ paidById: owner.id, shareAmounts: { [owner.id]: 500_000, [friend.id]: 400_000 }, ...over });

    it("stores exact amounts and returns them", async () => {
      const r = await call(addExpense, "POST", "/x", { params: p(), body: exact() });
      expect(r.status).toBe(201);
      expect(r.json.shareAmounts).toEqual({ [owner.id]: 500_000, [friend.id]: 400_000 });
      expect(r.json.splitAmong.sort()).toEqual([owner.id, friend.id].sort());
      const t = (await call(getTrip, "GET", "/x", { params: p() })).json;
      expect(t.expenses[0].shareAmounts).toEqual(r.json.shareAmounts);
    });

    it("equal splits report shareAmounts as null", async () => {
      const r = await call(addExpense, "POST", "/x", { params: p(), body: body({ paidById: owner.id, splitAmong: [owner.id, friend.id] }) });
      expect(r.json.shareAmounts).toBeNull();
    });

    it("rejects amounts that do not add up to the cost, and people outside the trip", async () => {
      expect((await call(addExpense, "POST", "/x", { params: p(), body: exact({ actual: 1_000_000 }) })).status).toBe(400);
      expect((await call(addExpense, "POST", "/x", { params: p(), body: exact({ shareAmounts: { [stranger.id]: 900_000 } }) })).status).toBe(400);
    });

    it("can switch an expense between exact and equal, and guards the cost while exact", async () => {
      const id = (await call(addExpense, "POST", "/x", { params: p(), body: exact() })).json.id;
      const pp = { id: tripId, expenseId: id };
      expect((await call(patchExpense, "PATCH", "/x", { params: pp, body: { actual: 1_000_000 } })).status).toBe(400);
      const ok = await call(patchExpense, "PATCH", "/x", { params: pp, body: { actual: 1_000_000, shareAmounts: { [owner.id]: 600_000, [friend.id]: 400_000 } } });
      expect(ok.status).toBe(200);
      expect(ok.json.shareAmounts[owner.id]).toBe(600_000);
      const back = await call(patchExpense, "PATCH", "/x", { params: pp, body: { splitAmong: [] } });
      expect(back.status).toBe(200);
      expect(back.json.shareAmounts).toBeNull();
      expect(back.json.splitAmong).toEqual([]);
    });

    it("viewers cannot change shares", async () => {
      const id = (await call(addExpense, "POST", "/x", { params: p(), body: exact() })).json.id;
      await actAs(viewer);
      expect((await call(patchExpense, "PATCH", "/x", { params: { id: tripId, expenseId: id }, body: { splitAmong: [] } })).status).toBe(403);
    });
  });
});

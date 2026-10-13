import { beforeEach, describe, expect, it } from "vitest";
import { actAs, call, makeDestination, makeUser, prisma, resetDb } from "./helpers";
import { GET as listTrips } from "@/app/api/trips/route";
import { DELETE as delTrip, GET as getTrip, PATCH as patchTrip } from "@/app/api/trips/[id]/route";
import { POST as addItem } from "@/app/api/trips/[id]/items/route";
import { POST as addExpense } from "@/app/api/trips/[id]/expenses/route";
import { POST as share } from "@/app/api/trips/[id]/share/route";
import { POST as invite } from "@/app/api/trips/[id]/invite/route";
import { DELETE as delMember, PATCH as patchMember } from "@/app/api/trips/[id]/members/[userId]/route";
import { GET as preview } from "@/app/api/invites/[token]/route";
import { POST as join } from "@/app/api/invites/[token]/join/route";

type U = Awaited<ReturnType<typeof makeUser>>;
let owner: U, editor: U, viewer: U, outsider: U, tripId: string, destId: string;

beforeEach(async () => {
  await resetDb();
  [owner, editor, viewer, outsider] = [await makeUser("o@x.com"), await makeUser("e@x.com"), await makeUser("v@x.com"), await makeUser("x@x.com")];
  destId = (await makeDestination("hoi-an")).id;
  tripId = (await prisma.trip.create({ data: { title: "T", startDate: new Date("2026-12-01"), endDate: new Date("2026-12-03"), userId: owner.id } })).id;
  await prisma.tripMember.createMany({ data: [{ tripId, userId: editor.id, role: "EDITOR" }, { tripId, userId: viewer.id, role: "VIEWER" }] });
});

const p = () => ({ id: tripId });

describe("roles", () => {
  it("editor can edit items, expenses and the trip, but not delete/share/invite", async () => {
    await actAs(editor);
    expect((await call(addItem, "POST", "/x", { params: p(), body: { destinationId: destId, day: 1 } })).status).toBe(201);
    expect((await call(addExpense, "POST", "/x", { params: p(), body: { title: "a", category: "food" } })).status).toBe(201);
    expect((await call(patchTrip, "PATCH", "/x", { params: p(), body: { budget: 5 } })).status).toBe(200);
    expect((await call(delTrip, "DELETE", "/x", { params: p() })).status).toBe(403);
    expect((await call(share, "POST", "/x", { params: p(), body: { enabled: true } })).status).toBe(403);
    expect((await call(invite, "POST", "/x", { params: p(), body: { enabled: true } })).status).toBe(403);
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: tripId } })).inviteToken).toBeNull();
  });

  it("viewer can read but every write is 403 and changes nothing", async () => {
    await actAs(viewer);
    const t = await call(getTrip, "GET", "/x", { params: p() });
    expect(t.status).toBe(200);
    expect(t.json.myRole).toBe("VIEWER");
    expect(t.json).not.toHaveProperty("inviteToken");
    expect((await call(addItem, "POST", "/x", { params: p(), body: { destinationId: destId, day: 1 } })).status).toBe(403);
    expect((await call(addExpense, "POST", "/x", { params: p(), body: { title: "a", category: "food" } })).status).toBe(403);
    expect((await call(patchTrip, "PATCH", "/x", { params: p(), body: { title: "pwn" } })).status).toBe(403);
    expect((await call(delTrip, "DELETE", "/x", { params: p() })).status).toBe(403);
    expect(await prisma.tripItem.count()).toBe(0);
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: tripId } })).title).toBe("T");
  });

  it("outsiders still get 404; members see the trip in their list", async () => {
    await actAs(outsider);
    expect((await call(getTrip, "GET", "/x", { params: p() })).status).toBe(404);
    expect((await call(listTrips, "GET", "/x")).json).toHaveLength(0);
    await actAs(editor);
    const list = (await call(listTrips, "GET", "/x")).json;
    expect(list).toHaveLength(1);
    expect(list[0].shared).toBe(true);
  });

  it("only the owner sees invite settings", async () => {
    await actAs(owner);
    await call(invite, "POST", "/x", { params: p(), body: { enabled: true, role: "VIEWER" } });
    const t = (await call(getTrip, "GET", "/x", { params: p() })).json;
    expect(t.myRole).toBe("OWNER");
    expect(t.inviteToken).toHaveLength(24);
    await actAs(editor);
    expect(JSON.stringify((await call(getTrip, "GET", "/x", { params: p() })).json)).not.toContain(t.inviteToken);
  });
});

describe("invite links", () => {
  const enable = async (role: "EDITOR" | "VIEWER") => {
    await actAs(owner);
    return (await call(invite, "POST", "/x", { params: p(), body: { enabled: true, role } })).json.inviteToken as string;
  };

  it("requires login, joins with the link's role, and is idempotent", async () => {
    const token = await enable("VIEWER");
    await actAs(null);
    expect((await call(join, "POST", "/x", { params: { token } })).status).toBe(401);
    await actAs(outsider);
    expect((await call(preview, "GET", "/x", { params: { token } })).json).toMatchObject({ role: "VIEWER", alreadyMember: false });
    expect((await call(join, "POST", "/x", { params: { token } })).status).toBe(200);
    expect((await prisma.tripMember.findUniqueOrThrow({ where: { tripId_userId: { tripId, userId: outsider.id } } })).role).toBe("VIEWER");
    await call(join, "POST", "/x", { params: { token } });
    expect(await prisma.tripMember.count({ where: { tripId } })).toBe(3);
  });

  it("joining never changes an existing member's role or makes the owner a member", async () => {
    const token = await enable("VIEWER");
    await actAs(editor);
    await call(join, "POST", "/x", { params: { token } });
    expect((await prisma.tripMember.findUniqueOrThrow({ where: { tripId_userId: { tripId, userId: editor.id } } })).role).toBe("EDITOR");
    await actAs(owner);
    await call(join, "POST", "/x", { params: { token } });
    expect(await prisma.tripMember.count({ where: { userId: owner.id } })).toBe(0);
  });

  it("disabling the link kills it; garbage tokens are 404", async () => {
    const token = await enable("EDITOR");
    await call(invite, "POST", "/x", { params: p(), body: { enabled: false } });
    await actAs(outsider);
    expect((await call(join, "POST", "/x", { params: { token } })).status).toBe(404);
    expect((await call(preview, "GET", "/x", { params: { token: "short" } })).status).toBe(404);
  });
});

describe("member management", () => {
  it("owner changes roles and removes members; others cannot", async () => {
    await actAs(editor);
    expect((await call(patchMember, "PATCH", "/x", { params: { id: tripId, userId: viewer.id }, body: { role: "EDITOR" } })).status).toBe(403);
    expect((await call(delMember, "DELETE", "/x", { params: { id: tripId, userId: viewer.id } })).status).toBe(403);
    await actAs(owner);
    expect((await call(patchMember, "PATCH", "/x", { params: { id: tripId, userId: viewer.id }, body: { role: "EDITOR" } })).status).toBe(200);
    expect((await call(delMember, "DELETE", "/x", { params: { id: tripId, userId: viewer.id } })).status).toBe(200);
    await actAs(viewer);
    expect((await call(getTrip, "GET", "/x", { params: p() })).status).toBe(404);
  });

  it("a member can leave on their own", async () => {
    await actAs(editor);
    expect((await call(delMember, "DELETE", "/x", { params: { id: tripId, userId: editor.id } })).status).toBe(200);
    expect((await call(getTrip, "GET", "/x", { params: p() })).status).toBe(404);
  });
});

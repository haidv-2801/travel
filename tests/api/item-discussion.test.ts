import { beforeEach, describe, expect, it } from "vitest";
import { actAs, call, makeDestination, makeUser, prisma, resetDb } from "./helpers";
import { GET as getTrip } from "@/app/api/trips/[id]/route";
import { PUT as vote } from "@/app/api/trips/[id]/items/[itemId]/vote/route";
import { GET as listComments, POST as addComment } from "@/app/api/trips/[id]/items/[itemId]/comments/route";
import { DELETE as delComment } from "@/app/api/trips/[id]/comments/[commentId]/route";
import { DELETE as delItem } from "@/app/api/trips/[id]/items/[itemId]/route";
import { DELETE as delMember } from "@/app/api/trips/[id]/members/[userId]/route";

type U = Awaited<ReturnType<typeof makeUser>>;
let owner: U, friend: U, viewer: U, stranger: U, tripId: string, itemId: string;
const P = (extra: object = {}) => ({ id: tripId, itemId, ...extra });
const say = (u: U | null, body: unknown) => actAs(u).then(() => call(addComment, "POST", "/x", { params: P(), body: { body } }));

beforeEach(async () => {
  await resetDb();
  [owner, friend, viewer, stranger] = [await makeUser("o@x.com"), await makeUser("f@x.com"), await makeUser("v@x.com"), await makeUser("s@x.com")];
  const dest = await makeDestination("hoi-an");
  const trip = await prisma.trip.create({
    data: {
      title: "T", startDate: new Date("2026-12-01"), endDate: new Date("2026-12-03"), userId: owner.id,
      members: { create: [{ userId: friend.id, role: "EDITOR" }, { userId: viewer.id, role: "VIEWER" }] },
      items: { create: { destinationId: dest.id, day: 1, position: 0 } },
    },
    include: { items: true },
  });
  tripId = trip.id; itemId = trip.items[0].id;
});

const put = (u: U | null, value: unknown, over: object = {}) => actAs(u).then(() => call(vote, "PUT", "/x", { params: P(over), body: { value } }));

describe("votes", () => {
  it("each member has one vote that can be changed or removed", async () => {
    expect((await put(owner, 1)).status).toBe(200);
    expect((await put(friend, -1)).json.votes).toHaveLength(2);
    await put(friend, 1);
    expect(await prisma.tripItemVote.count({ where: { itemId } })).toBe(2);
    expect((await prisma.tripItemVote.findUniqueOrThrow({ where: { itemId_userId: { itemId, userId: friend.id } } })).value).toBe(1);
    await put(friend, 0);
    expect(await prisma.tripItemVote.count({ where: { itemId } })).toBe(1);
  });

  it("is returned with the trip along with the comment count", async () => {
    await put(owner, 1); await put(friend, -1); await say(owner, "hay");
    const it = (await call(getTrip, "GET", "/x", { params: { id: tripId } })).json.items[0];
    expect(it.votes.map((v: { value: number }) => v.value).sort()).toEqual([-1, 1]);
    expect(it._count.comments).toBe(1);
  });

  it("rejects bad values, viewers, outsiders, anonymous users and items from another trip", async () => {
    expect((await put(owner, 5)).status).toBe(400);
    expect((await put(viewer, 1)).status).toBe(403);
    expect((await put(stranger, 1)).status).toBe(404);
    expect((await put(null, 1)).status).toBe(401);
    expect((await put(owner, 1, { itemId: "ghost" })).status).toBe(404);
    const other = await prisma.trip.create({ data: { title: "O", startDate: new Date(), endDate: new Date(), userId: stranger.id } });
    expect((await put(owner, 1, { id: other.id })).status).toBe(404); // not my trip
    expect(await prisma.tripItemVote.count()).toBe(0);
  });
});

describe("comments", () => {
  it("editors can comment; everyone who can see the trip can read; order is oldest first", async () => {
    expect((await say(owner, "đi sáng sớm")).status).toBe(201);
    expect((await say(friend, "ok")).json.user.name).toBe("f");
    await actAs(viewer);
    const r = await call(listComments, "GET", "/x", { params: P() });
    expect(r.json.map((c: { body: string }) => c.body)).toEqual(["đi sáng sớm", "ok"]);
    expect(JSON.stringify(r.json)).not.toContain("@x.com");
  });

  it("validates the body and blocks viewers and outsiders", async () => {
    expect((await say(owner, "   ")).status).toBe(400);
    expect((await say(owner, "x".repeat(501))).status).toBe(400);
    expect((await say(viewer, "hi")).status).toBe(403);
    expect((await say(stranger, "hi")).status).toBe(404);
    await actAs(stranger);
    expect((await call(listComments, "GET", "/x", { params: P() })).status).toBe(404);
    expect(await prisma.tripItemComment.count()).toBe(0);
  });

  it("only the author or the trip owner can delete", async () => {
    const mine = (await say(friend, "của friend")).json.id;
    const del = (u: U, id: string) => actAs(u).then(() => call(delComment, "DELETE", "/x", { params: { id: tripId, commentId: id } }));
    expect((await del(viewer, mine)).status).toBe(403);
    expect((await del(stranger, mine)).status).toBe(404);
    const second = (await say(friend, "again")).json.id;
    expect((await del(friend, mine)).status).toBe(200);
    expect((await del(owner, second)).status).toBe(200);
    expect((await del(owner, "ghost")).status).toBe(404);
  });

  it("deleting a place removes its votes and comments", async () => {
    await put(owner, 1); await say(owner, "hi");
    await actAs(owner);
    expect((await call(delItem, "DELETE", "/x", { params: { id: tripId, itemId } })).status).toBe(200);
    expect(await prisma.tripItemVote.count()).toBe(0);
    expect(await prisma.tripItemComment.count()).toBe(0);
  });

  it("removing a member drops their votes in this trip but keeps their comments", async () => {
    await put(friend, 1); await say(friend, "mình đi");
    await actAs(owner);
    await call(delMember, "DELETE", "/x", { params: { id: tripId, userId: friend.id } });
    expect(await prisma.tripItemVote.count()).toBe(0);
    expect(await prisma.tripItemComment.count()).toBe(1);
  });
});

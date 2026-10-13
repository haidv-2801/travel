import { beforeEach, describe, expect, it } from "vitest";
import { actAs, call, makeDestination, makeUser, prisma, resetDb } from "./helpers";
import { GET as listFavs, POST as addFav } from "@/app/api/favorites/route";
import { DELETE as delFav } from "@/app/api/favorites/[destinationId]/route";
import { GET as listReviews, POST as postReview } from "@/app/api/destinations/[id]/reviews/route";
import { DELETE as delReview } from "@/app/api/reviews/[id]/route";

let a: Awaited<ReturnType<typeof makeUser>>, b: typeof a, admin: typeof a, d: Awaited<ReturnType<typeof makeDestination>>;
beforeEach(async () => {
  await resetDb();
  a = await makeUser("a@x.com"); b = await makeUser("b@x.com"); admin = await makeUser("admin@x.com", "ADMIN");
  d = await makeDestination("hoi-an");
});

describe("favorites", () => {
  it("requires login, is idempotent, is per-user, and can be removed", async () => {
    await actAs(null);
    expect((await call(listFavs, "GET", "/x")).status).toBe(401);
    await actAs(a);
    expect((await call(addFav, "POST", "/x", { body: { destinationId: d.id } })).status).toBe(201);
    expect((await call(addFav, "POST", "/x", { body: { destinationId: d.id } })).status).toBe(201);
    expect((await call(listFavs, "GET", "/x")).json).toHaveLength(1);
    await actAs(b);
    expect((await call(listFavs, "GET", "/x")).json).toHaveLength(0);
    await call(delFav, "DELETE", "/x", { params: { destinationId: d.id } }); // b removing: no effect on a
    await actAs(a);
    expect((await call(listFavs, "GET", "/x")).json).toHaveLength(1);
    await call(delFav, "DELETE", "/x", { params: { destinationId: d.id } });
    expect((await call(listFavs, "GET", "/x")).json).toHaveLength(0);
  });
  it("unknown destination is 404", async () => {
    await actAs(a);
    expect((await call(addFav, "POST", "/x", { body: { destinationId: "ghost" } })).status).toBe(404);
  });
});

describe("reviews", () => {
  const rate = (rating: number, comment = "ok") => call(postReview, "POST", "/x", { params: { id: d.id }, body: { rating, comment } });
  const stats = async () => { const x = await prisma.destination.findUniqueOrThrow({ where: { id: d.id } }); return [x.rating, x.reviewCount]; };

  it("requires login and validates input", async () => {
    await actAs(null);
    expect((await rate(5)).status).toBe(401);
    await actAs(a);
    expect((await rate(0)).status).toBe(400);
    expect((await rate(6)).status).toBe(400);
    expect((await call(postReview, "POST", "/x", { params: { id: d.id }, body: { rating: 3, comment: "x", imageUrl: "http://insecure/x.png" } })).status).toBe(400);
    expect((await call(postReview, "POST", "/x", { params: { id: "ghost" }, body: { rating: 3, comment: "x" } })).status).toBe(404);
  });

  it("one review per user (re-posting updates) and the average is recomputed", async () => {
    await actAs(a); await rate(5);
    await actAs(b); await rate(2);
    expect(await stats()).toEqual([3.5, 2]);
    await actAs(a); await rate(4);
    expect(await prisma.review.count()).toBe(2);
    expect(await stats()).toEqual([3, 2]);
  });

  it("only the author or an admin can delete; stats follow", async () => {
    await actAs(a); await rate(5);
    await actAs(b); const rb = (await rate(1)).json;
    await actAs(a);
    expect((await call(delReview, "DELETE", "/x", { params: { id: rb.id } })).status).toBe(403);
    expect(await stats()).toEqual([3, 2]);
    await actAs(admin);
    expect((await call(delReview, "DELETE", "/x", { params: { id: rb.id } })).status).toBe(200);
    expect(await stats()).toEqual([5, 1]);
    const ra = await prisma.review.findFirstOrThrow({ where: { userId: a.id } });
    await actAs(a);
    expect((await call(delReview, "DELETE", "/x", { params: { id: ra.id } })).status).toBe(200);
    expect(await stats()).toEqual([0, 0]);
  });

  it("listing is public, paginated, newest first, without author emails", async () => {
    await actAs(a); await rate(5, "first");
    await actAs(b); await rate(4, "second");
    await actAs(null);
    const r = await call(listReviews, "GET", "/x", { params: { id: d.id } });
    expect(r.json.items.map((i: { comment: string }) => i.comment)).toEqual(["second", "first"]);
    expect(JSON.stringify(r.json)).not.toContain("@x.com");
  });
});

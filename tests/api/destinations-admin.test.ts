import { beforeEach, describe, expect, it } from "vitest";
import { actAs, call, makeDestination, makeUser, prisma, resetDb } from "./helpers";
import { GET as list, POST as create } from "@/app/api/destinations/route";
import { DELETE as del, GET as getOne, PATCH as patch } from "@/app/api/destinations/[id]/route";
import { GET as listUsers } from "@/app/api/admin/users/route";
import { PATCH as setRole } from "@/app/api/admin/users/[id]/route";
import { POST as addItem } from "@/app/api/trips/[id]/items/route";
import { POST as createTrip } from "@/app/api/trips/route";

let admin: Awaited<ReturnType<typeof makeUser>>, user: typeof admin;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser("admin@x.com", "ADMIN");
  user = await makeUser("user@x.com");
});

describe("destination search", () => {
  beforeEach(async () => {
    await makeDestination("da-lat", { name: "Đà Lạt", city: "Lâm Đồng", searchText: "da lat lam dong", region: "Tây Nguyên", rating: 4.7 });
    await makeDestination("ha-long", { name: "Vịnh Hạ Long", city: "Quảng Ninh", searchText: "vinh ha long quang ninh", region: "Miền Bắc", avgCost: 600000, rating: 4.8 });
  });
  const names = async (qs: string) => (await call(list, "GET", `/api/destinations${qs}`)).json.items.map((d: { name: string }) => d.name);

  it("is public and accent-insensitive", async () => {
    expect(await names("?q=da%20lat")).toEqual(["Đà Lạt"]);
    expect(await names("?q=HA%20LONG")).toEqual(["Vịnh Hạ Long"]);
  });
  it("filters by region and max cost; orders by rating", async () => {
    expect(await names("?region=Mi%E1%BB%81n%20B%E1%BA%AFc")).toEqual(["Vịnh Hạ Long"]);
    expect(await names("?maxCost=200000")).toEqual(["Đà Lạt"]);
    expect(await names("")).toEqual(["Vịnh Hạ Long", "Đà Lạt"]);
  });
  it("paginates and caps pageSize", async () => {
    const r = await call(list, "GET", "/api/destinations?pageSize=1&page=2");
    expect(r.json).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(r.json.items).toHaveLength(1);
    expect((await call(list, "GET", "/api/destinations?pageSize=9999")).json.pageSize).toBe(50);
  });
  it("detail works by id or slug; unknown is 404", async () => {
    expect((await call(getOne, "GET", "/x", { params: { id: "da-lat" } })).json.name).toBe("Đà Lạt");
    expect((await call(getOne, "GET", "/x", { params: { id: "nope" } })).status).toBe(404);
  });
});

describe("admin-only mutations", () => {
  const body = (categoryId: string) => ({ name: "Mới", slug: "moi", description: "d", city: "Huế", region: "Miền Trung", lat: 16.4, lng: 107.5, avgCost: 1, categoryId });

  it("anonymous 401, user 403, admin 201 (and search text is generated)", async () => {
    const cat = await prisma.category.create({ data: { name: "C", slug: "c" } });
    await actAs(null);
    expect((await call(create, "POST", "/x", { body: body(cat.id) })).status).toBe(401);
    await actAs(user);
    expect((await call(create, "POST", "/x", { body: body(cat.id) })).status).toBe(403);
    await actAs(admin);
    const r = await call(create, "POST", "/x", { body: body(cat.id) });
    expect(r.status).toBe(201);
    expect(r.json.searchText).toBe("moi hue");
    expect((await call(create, "POST", "/x", { body: body(cat.id) })).status).toBe(409); // duplicate slug
  });

  it("patch recomputes searchText; delete is blocked while used in a trip", async () => {
    const d = await makeDestination("x1", { name: "Cũ", city: "Huế", searchText: "cu hue" });
    await actAs(admin);
    expect((await call(patch, "PATCH", "/x", { params: { id: d.id }, body: { name: "Mới Tinh" } })).json.searchText).toBe("moi tinh hue");
    await actAs(user);
    expect((await call(patch, "PATCH", "/x", { params: { id: d.id }, body: { name: "hack" } })).status).toBe(403);
    expect((await call(del, "DELETE", "/x", { params: { id: d.id } })).status).toBe(403);
    const trip = (await call(createTrip, "POST", "/x", { body: { title: "T", startDate: "2026-12-01", endDate: "2026-12-01" } })).json;
    await call(addItem, "POST", "/x", { params: { id: trip.id }, body: { destinationId: d.id, day: 1 } });
    await actAs(admin);
    expect((await call(del, "DELETE", "/x", { params: { id: d.id } })).status).toBe(409);
  });
});

describe("user management", () => {
  it("only admins list users; password hashes are never returned", async () => {
    await actAs(user);
    expect((await call(listUsers, "GET", "/x")).status).toBe(403);
    await actAs(admin);
    const r = await call(listUsers, "GET", "/x");
    expect(r.json).toHaveLength(2);
    expect(JSON.stringify(r.json)).not.toContain("passwordHash");
  });
  it("admin can change roles but not their own", async () => {
    await actAs(admin);
    expect((await call(setRole, "PATCH", "/x", { params: { id: user.id }, body: { role: "ADMIN" } })).status).toBe(200);
    expect((await call(setRole, "PATCH", "/x", { params: { id: admin.id }, body: { role: "USER" } })).status).toBe(400);
    expect((await call(setRole, "PATCH", "/x", { params: { id: "ghost" }, body: { role: "USER" } })).status).toBe(404);
    expect((await call(setRole, "PATCH", "/x", { params: { id: user.id }, body: { role: "ROOT" } })).status).toBe(400);
  });
  it("a role change takes effect immediately even with an old token", async () => {
    await actAs(user); // token says USER
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    expect((await call(listUsers, "GET", "/x")).status).toBe(200);
    await prisma.user.update({ where: { id: user.id }, data: { role: "USER" } });
    await actAs({ id: user.id, role: "ADMIN" }); // stale token claiming ADMIN
    expect((await call(listUsers, "GET", "/x")).status).toBe(403);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { actAs, call, makeUser, resetDb } from "./helpers";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";

beforeEach(resetDb);

describe("auth", () => {
  it("registers, hashes the password, and logs the user in", async () => {
    const r = await call(register, "POST", "/api/auth/register", { body: { name: "A", email: "A@x.com", password: "password123" } });
    expect(r.status).toBe(201);
    expect(r.json).not.toHaveProperty("passwordHash");
    expect(r.json.role).toBe("USER");
    const m = await call(me, "GET", "/api/auth/me");
    expect(m.json.user.email).toBe("a@x.com");
  });

  it("rejects duplicate emails (case-insensitive) and weak passwords", async () => {
    await makeUser("a@x.com");
    expect((await call(register, "POST", "/x", { body: { name: "A", email: "A@X.com", password: "password123" } })).status).toBe(409);
    expect((await call(register, "POST", "/x", { body: { name: "A", email: "b@x.com", password: "short" } })).status).toBe(400);
  });

  it("cannot self-assign ADMIN at registration", async () => {
    const r = await call(register, "POST", "/x", { body: { name: "A", email: "evil@x.com", password: "password123", role: "ADMIN" } });
    expect(r.json.role).toBe("USER");
  });

  it("login succeeds with the right password and fails (same message) otherwise", async () => {
    await makeUser("a@x.com");
    expect((await call(login, "POST", "/x", { body: { email: "a@x.com", password: "password123" } })).status).toBe(200);
    const wrong = await call(login, "POST", "/x", { body: { email: "a@x.com", password: "nope-nope" } });
    const unknown = await call(login, "POST", "/x", { body: { email: "zzz@x.com", password: "nope-nope" } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json.error).toBe(unknown.json.error); // no user enumeration
  });

  it("logout clears the session", async () => {
    const u = await makeUser("a@x.com");
    await actAs(u);
    expect((await call(me, "GET", "/x")).json.user).not.toBeNull();
    await call(logout, "POST", "/x");
    expect((await call(me, "GET", "/x")).json.user).toBeNull();
  });

  it("login is rate limited per ip+email", async () => {
    await makeUser("a@x.com");
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const req = new Request("http://t/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" }, body: JSON.stringify({ email: "a@x.com", password: "wrongwrong" }) });
      statuses.push((await login(req, { params: Promise.resolve({}) })).status);
    }
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
  });
});

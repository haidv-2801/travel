import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actAs, call, makeDestination, makeUser, prisma, resetDb } from "./helpers";
import { GET as uploadsEnabled, POST as upload } from "@/app/api/uploads/route";
import { POST as postReview } from "@/app/api/destinations/[id]/reviews/route";
import { DELETE as delReview } from "@/app/api/reviews/[id]/route";
import { sniffImage } from "@/lib/storage";

const SB = "https://proj.supabase.co";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 1, 2]);

type U = Awaited<ReturnType<typeof makeUser>>;
let a: U, b: U, destId: string;
let calls: { url: string; init: RequestInit }[];
let ip = 0;

const send = (file?: { bytes: Uint8Array; name?: string; type?: string }) => {
  const form = new FormData();
  if (file) form.append("file", new File([file.bytes as BlobPart], file.name ?? "x.png", { type: file.type ?? "image/png" }));
  const req = new Request("http://test/api/uploads", { method: "POST", body: form, headers: { "x-forwarded-for": `8.8.${Math.floor(++ip / 250)}.${ip % 250}` } });
  return upload(req, { params: Promise.resolve({}) }).then(async (r) => ({ status: r.status, json: await r.json() }));
};

beforeEach(async () => {
  await resetDb();
  process.env.SUPABASE_URL = SB; process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-for-tests"; process.env.SUPABASE_STORAGE_BUCKET = "review-photos";
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { calls.push({ url: String(url), init }); return new Response("{}", { status: 200 }); }));
  [a, b] = [await makeUser("a@x.com"), await makeUser("b@x.com")];
  destId = (await makeDestination("hoi-an")).id;
  await actAs(a);
});
afterEach(() => { vi.unstubAllGlobals(); for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET"]) delete process.env[k]; });

describe("magic-byte sniffing", () => {
  it("recognises jpeg/png/webp and rejects everything else", () => {
    expect([sniffImage(JPG), sniffImage(PNG), sniffImage(WEBP)]).toEqual(["image/jpeg", "image/png", "image/webp"]);
    for (const bad of [new Uint8Array(), new Uint8Array(Buffer.from("<svg onload=alert(1)>")), new Uint8Array(Buffer.from("GIF89a....")), new Uint8Array(Buffer.from("%PDF-1.7......"))]) expect(sniffImage(bad)).toBeNull();
  });
});

describe("POST /api/uploads", () => {
  it("requires login and a configured bucket", async () => {
    await actAs(null);
    expect((await send({ bytes: PNG })).status).toBe(401);
    await actAs(a);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await send({ bytes: PNG })).status).toBe(503);
    expect((await call(uploadsEnabled, "GET", "/x")).json).toEqual({ enabled: false });
    expect(calls).toHaveLength(0);
  });

  it("stores a valid image under the user's own folder with the service key and returns its public URL", async () => {
    expect((await call(uploadsEnabled, "GET", "/x")).json).toEqual({ enabled: true });
    const r = await send({ bytes: JPG, name: "../../evil.php", type: "text/plain" }); // client-supplied name/type are ignored
    expect(r.status).toBe(201);
    expect(r.json.url).toMatch(new RegExp(`^${SB}/storage/v1/object/public/review-photos/reviews/${a.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(new RegExp(`^${SB}/storage/v1/object/review-photos/reviews/${a.id}/`));
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>)["Content-Type"]).toBe("image/jpeg");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer service-key-for-tests");
  });

  it("rejects non-images even when labelled as images, empty files, oversize files and missing files", async () => {
    expect((await send({ bytes: new Uint8Array(Buffer.from("<script>alert(1)</script>")), type: "image/png", name: "a.png" })).status).toBe(415);
    expect((await send({ bytes: new Uint8Array() })).status).toBe(400);
    expect((await send({ bytes: new Uint8Array(5 * 1024 * 1024 + 1).fill(0xff) })).status).toBe(413);
    expect((await send()).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("surfaces a storage failure as 502 and limits uploads per user", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    expect((await send({ bytes: PNG })).status).toBe(502);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await send({ bytes: PNG })).status);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});

describe("review photos", () => {
  const review = (u: U, imageUrl: string | null) => actAs(u).then(() => call(postReview, "POST", "/x", { params: { id: destId }, body: { rating: 5, comment: "đẹp", imageUrl } }));
  const own = (u: U, name = "p.jpg") => `${SB}/storage/v1/object/public/review-photos/reviews/${u.id}/${name}`;

  it("accepts the user's own photo and plain https links, but not someone else's stored photo", async () => {
    expect((await review(a, own(a))).status).toBe(201);
    expect((await review(a, "https://example.com/x.png")).status).toBe(201);
    expect((await review(b, own(a))).status).toBe(400);
    expect((await review(b, `${SB}/storage/v1/object/public/review-photos/reviews/${a.id}/../${b.id}/x.jpg`)).status).toBe(400);
    expect((await review(b, `${SB}/storage/v1/object/public/review-photos/reviews/${b.id}/../${a.id}/x.jpg`)).status).toBe(400); // starts in b's folder, escapes into a's
    expect((await review(b, `${SB}/storage/v1/object/public/review-photos/reviews/${b.id}/%2e%2e/${a.id}/x.jpg`)).status).toBe(400);
  });

  it("deleting a review (or replacing its photo) removes only the author's own stored file", async () => {
    const id = (await review(a, own(a, "one.jpg"))).json.id;
    await review(a, own(a, "two.jpg")); // replaces one.jpg
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([`DELETE ${SB}/storage/v1/object/review-photos/reviews/${a.id}/one.jpg`]);
    calls.length = 0;
    await actAs(a);
    expect((await call(delReview, "DELETE", "/x", { params: { id } })).status).toBe(200);
    expect(calls.map((c) => c.url)).toEqual([`${SB}/storage/v1/object/review-photos/reviews/${a.id}/two.jpg`]);
  });

  it("never deletes a file outside the author's folder, even if the record points there", async () => {
    // a legacy/forged record pointing at b's file, deleted by admin or by a
    const r = await prisma.review.create({ data: { userId: a.id, destinationId: destId, rating: 3, comment: "x", imageUrl: own(b) } });
    await actAs(a);
    expect((await call(delReview, "DELETE", "/x", { params: { id: r.id } })).status).toBe(200);
    expect(calls).toHaveLength(0);
  });
});

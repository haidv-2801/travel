import { randomUUID } from "node:crypto";
import { HttpError } from "./http";

/**
 * Image storage on Supabase Storage via its REST API (no SDK). The service-role key only ever lives on the server:
 * the browser uploads to /api/uploads, which checks the user and the file, then stores it in a public-read bucket.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Config = { url: string; key: string; bucket: string };

function config(): Config | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key, bucket: process.env.SUPABASE_STORAGE_BUCKET || "review-photos" };
}

export const storageConfigured = () => config() !== null;

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
type ImageType = keyof typeof EXT;

/** Detects the real image type from the file's magic bytes (the browser-supplied type is not trusted). */
export function sniffImage(b: Uint8Array): ImageType | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  const ascii = (from: number, s: string) => [...s].every((c, i) => b[from + i] === c.charCodeAt(0));
  if (b.length > 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  return null;
}

/** Folder a user's review photos live in; used to make sure users only reference and delete their own files. */
export const reviewFolder = (userId: string) => `reviews/${userId}/`;

const publicPrefix = (c: Config) => `${c.url}/storage/v1/object/public/${c.bucket}/`;

/** The object path if `url` points into our bucket, else null. */
export function ownObjectPath(url: string | null | undefined): string | null {
  const c = config();
  if (!c || !url?.startsWith(publicPrefix(c))) return null;
  return decodeURIComponent(url.slice(publicPrefix(c).length).split(/[?#]/)[0]);
}

/** Uploads an image under the user's review folder and returns its public URL. */
export async function uploadReviewImage(userId: string, bytes: Uint8Array, type: ImageType) {
  const c = config();
  if (!c) throw new HttpError(503, "Image upload is not configured");
  const path = `${reviewFolder(userId)}${randomUUID()}.${EXT[type]}`;
  const res = await fetch(`${c.url}/storage/v1/object/${c.bucket}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.key}`, apikey: c.key, "Content-Type": type, "Cache-Control": "max-age=31536000", "x-upsert": "false" },
    body: bytes as BodyInit,
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res?.ok) {
    console.error("storage upload failed", res?.status, await res?.text().catch(() => ""));
    throw new HttpError(502, "Could not store the image, please try again");
  }
  return `${publicPrefix(c)}${path}`;
}

/** Best-effort removal of a user's own stored image (never throws, never touches other users' files). */
export async function deleteOwnImage(url: string | null | undefined, ownerId: string) {
  const c = config();
  const path = ownObjectPath(url);
  if (!c || !path || !path.startsWith(reviewFolder(ownerId)) || path.includes("..")) return;
  await fetch(`${c.url}/storage/v1/object/${c.bucket}/${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${c.key}`, apikey: c.key },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

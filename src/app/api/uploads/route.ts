import { NextResponse } from "next/server";
import { handler, requireUser, HttpError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_IMAGE_BYTES, sniffImage, storageConfigured, uploadReviewImage } from "@/lib/storage";

/** Tells the UI whether photo upload is available (it needs the Supabase Storage env vars). */
export const GET = handler(async () => {
  await requireUser();
  return NextResponse.json({ enabled: storageConfigured() });
});

/** Upload one review photo (multipart field "file": JPEG, PNG or WebP, up to 5 MB). Returns { url }. */
export const POST = handler(async (req) => {
  const u = await requireUser();
  if (!storageConfigured()) throw new HttpError(503, "Image upload is not configured");
  if (!rateLimit(`upload:${u.id}`, 20, 3_600_000)) throw new HttpError(429, "Too many uploads, try again later");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES + 100_000) throw new HttpError(413, "Image is larger than 5 MB");

  let form: FormData;
  try { form = await req.formData(); } catch { throw new HttpError(400, "Expected multipart form data"); }
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, 'Missing "file"');
  if (file.size === 0) throw new HttpError(400, "Empty file");
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, "Image is larger than 5 MB");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) throw new HttpError(415, "Only JPEG, PNG or WebP images are allowed");
  return NextResponse.json({ url: await uploadReviewImage(u.id, bytes, type) }, { status: 201 });
});

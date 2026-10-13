import { NextResponse } from "next/server";
import { handler, requireUser, HttpError } from "@/lib/http";

const BASE = process.env.OSRM_URL ?? "https://router.project-osrm.org";
const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 60 * 60_000;

/**
 * GET /api/route?points=lat,lng;lat,lng;...   (2–25 points, in visiting order)
 * Proxies OSRM driving directions. Returns { distanceKm, durationMin, geometry: [lat,lng][] }
 * or 502 when the routing service is unavailable (the client falls back to straight lines).
 */
export const GET = handler(async (req) => {
  await requireUser();
  const raw = new URL(req.url).searchParams.get("points") ?? "";
  const pts = raw.split(";").map((p) => p.split(",").map(Number));
  if (pts.length < 2 || pts.length > 25 || pts.some((p) => p.length !== 2 || p.some((n) => !Number.isFinite(n)) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180))
    throw new HttpError(400, "points must be 2-25 'lat,lng' pairs separated by ';'");

  const key = pts.map((p) => p.map((n) => n.toFixed(4)).join(",")).join(";");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);

  const coords = pts.map(([lat, lng]) => `${lng},${lat}`).join(";");
  let json: { code?: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
  try {
    const res = await fetch(`${BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(8000) });
    json = await res.json();
  } catch {
    throw new HttpError(502, "Routing service unavailable");
  }
  const r = json.routes?.[0];
  if (json.code !== "Ok" || !r) throw new HttpError(502, "No route found");
  const body = { distanceKm: r.distance / 1000, durationMin: Math.round(r.duration / 60), geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]) };
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
});

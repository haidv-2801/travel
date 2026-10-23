import { must, type Db } from "./http";
import type { Row } from "./mappers";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Shared by the API route and the server-rendered destinations page. `q` must already be normalized. */
export async function searchDestinations(sb: Db, f: { q?: string; region?: string; category?: string; maxCost?: number; page: number; pageSize: number }) {
  // `categories!inner` makes the category filter apply to the destinations themselves.
  let query = sb.from("destinations").select(f.category ? "*, categories!inner(*)" : "*, categories(*)", { count: "exact" });
  if (f.q) query = query.ilike("search_text", `%${escapeLike(f.q)}%`);
  if (f.region) query = query.eq("region", f.region);
  if (f.category) query = query.eq("categories.slug", f.category);
  if (f.maxCost !== undefined) query = query.lte("avg_cost", f.maxCost);
  const from = (f.page - 1) * f.pageSize;
  const res = await query.order("rating", { ascending: false }).order("name").range(from, from + f.pageSize - 1);
  return { items: must(res) as unknown as Row[], total: res.count ?? 0 };
}

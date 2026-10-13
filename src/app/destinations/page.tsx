import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { vnd } from "@/lib/api";
import { normalize } from "@/lib/text";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 9;

export default async function Destinations({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.DestinationWhereInput = {
    ...(sp.q && { searchText: { contains: normalize(sp.q) } }),
    ...(sp.region && { region: sp.region }),
    ...(sp.category && { category: { slug: sp.category } }),
  };
  const [items, total, categories, regions] = await Promise.all([
    db.destination.findMany({ where, include: { category: true }, orderBy: [{ rating: "desc" }, { name: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.destination.count({ where }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.destination.findMany({ distinct: ["region"], select: { region: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const k of ["q", "region", "category"]) if (sp[k]) u.set(k, sp[k]!);
    u.set("page", String(p));
    return `/destinations?${u}`;
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Điểm đến</h1>
      <form className="card grid gap-3 sm:grid-cols-4" action="/destinations">
        <input className="input sm:col-span-1" name="q" placeholder="Tìm theo tên, thành phố…" defaultValue={sp.q} />
        <select className="input" name="region" defaultValue={sp.region ?? ""}>
          <option value="">Tất cả vùng</option>
          {regions.map((r) => <option key={r.region}>{r.region}</option>)}
        </select>
        <select className="input" name="category" defaultValue={sp.category ?? ""}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
        <button className="btn">Lọc</button>
      </form>
      <p className="text-sm text-slate-500">{total} kết quả</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((d) => (
          <Link key={d.id} href={`/destinations/${d.slug}`} className="card transition hover:border-brand-500">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{d.name}</h2>
              <span className="text-sm text-amber-600">★ {d.rating.toFixed(1)}</span>
            </div>
            <p className="text-xs text-slate-500">{d.city} · {d.region}</p>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{d.description}</p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{d.category.name}</span>
              <span className="text-slate-500">~{vnd(d.avgCost)}/người</span>
            </div>
          </Link>
        ))}
      </div>
      {items.length === 0 && <p className="text-slate-500">Không tìm thấy địa điểm phù hợp.</p>}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link className="btn-ghost" href={qs(page - 1)}>← Trước</Link>}
          <span>Trang {page}/{pages}</span>
          {page < pages && <Link className="btn-ghost" href={qs(page + 1)}>Sau →</Link>}
        </div>
      )}
    </div>
  );
}

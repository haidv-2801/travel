import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { vnd } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Favorites() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/favorites");
  const favs = await db.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { destination: { include: { category: true } } } });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Địa điểm yêu thích</h1>
      {favs.length === 0 && <p className="text-slate-500">Bạn chưa lưu địa điểm nào. <Link className="text-brand-600 underline" href="/destinations">Khám phá điểm đến</Link></p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favs.map(({ destination: d }) => (
          <Link key={d.id} href={`/destinations/${d.slug}`} className="card transition hover:border-brand-500">
            <div className="flex justify-between gap-2"><h2 className="font-semibold">{d.name}</h2><span className="text-sm text-amber-600">★ {d.rating.toFixed(1)}</span></div>
            <p className="text-xs text-slate-500">{d.city} · {d.region}</p>
            <div className="mt-3 flex justify-between text-xs"><span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{d.category.name}</span><span className="text-slate-500">~{vnd(d.avgCost)}/người</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

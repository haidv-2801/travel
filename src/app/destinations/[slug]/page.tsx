import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { vnd } from "@/lib/api";
import { TripMap } from "@/components/map-dynamic";
import { AddToTrip } from "@/components/add-to-trip";
import { FavoriteButton } from "@/components/favorite-button";
import { Reviews } from "@/components/reviews";

export const dynamic = "force-dynamic";

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await db.destination.findUnique({ where: { slug }, include: { category: true } });
  if (!d) notFound();
  const user = await getCurrentUser();
  const trips = user ? await db.trip.findMany({ where: { OR: [{ userId: user.id }, { members: { some: { userId: user.id, role: "EDITOR" } } }] }, orderBy: { startDate: "desc" }, select: { id: true, title: true, startDate: true, endDate: true } }) : [];
  const isFav = user ? !!(await db.favorite.findUnique({ where: { userId_destinationId: { userId: user.id, destinationId: d.id } } })) : false;
  const nearby = await db.destination.findMany({ where: { city: { not: d.city }, region: d.region, id: { not: d.id } }, take: 3, orderBy: { rating: "desc" } });

  return (
    <div className="space-y-5">
      <Link href="/destinations" className="text-sm text-brand-600">← Tất cả điểm đến</Link>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div>
            <h1 className="text-3xl font-bold">{d.name}</h1>
            <p className="text-slate-500">{d.city} · {d.region} · {d.category.name}</p>
          </div>
          <p className="text-slate-700">{d.description}</p>
          <div className="flex gap-6 text-sm">
            <span className="text-amber-600">★ {d.rating.toFixed(1)} <span className="text-slate-400">({d.reviewCount})</span></span>
            <span>Chi phí ước tính: <b>{vnd(d.avgCost)}</b>/người</span>
          </div>
          <FavoriteButton destinationId={d.id} initial={isFav} loggedIn={!!user} />
          {user ? (
            <AddToTrip destinationId={d.id} trips={trips.map((t) => ({ id: t.id, title: t.title, days: Math.round((+t.endDate - +t.startDate) / 86_400_000) + 1 }))} />
          ) : (
            <p className="text-sm text-slate-500"><Link className="text-brand-600 underline" href={`/login?next=/destinations/${d.slug}`}>Đăng nhập</Link> để thêm vào chuyến đi.</p>
          )}
          {nearby.length > 0 && (
            <div>
              <h2 className="mb-2 font-semibold">Gợi ý cùng vùng</h2>
              <div className="flex flex-wrap gap-2">
                {nearby.map((n) => <Link key={n.id} href={`/destinations/${n.slug}`} className="btn-ghost">{n.name}</Link>)}
              </div>
            </div>
          )}
        </div>
        <div className="lg:col-span-2">
          <TripMap points={[{ lat: d.lat, lng: d.lng, label: d.name }]} height={320} />
        </div>
      </div>
      <Reviews destinationId={d.id} user={user ? { id: user.id, role: user.role } : null} />
    </div>
  );
}

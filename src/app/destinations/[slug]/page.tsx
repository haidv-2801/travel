import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { destinationOut } from "@/lib/mappers";
import { vnd } from "@/lib/api";
import { TripMap } from "@/components/map-dynamic";
import { AddToTrip } from "@/components/add-to-trip";

export const dynamic = "force-dynamic";

export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await createClient();
  const { data: row } = await sb.from("destinations").select("*, categories(*)").eq("slug", slug).maybeSingle();
  if (!row) notFound();
  const d = destinationOut(row);
  const user = await getCurrentUser(sb);
  // Trips this user can add places to: their own and the ones they were invited to as an editor.
  const { data: tripRows } = user
    ? await sb.from("trips").select("id, title, start_date, end_date, owner_id, trip_members(user_id, role)").order("start_date", { ascending: false })
    : { data: [] };
  const trips = (tripRows ?? [])
    .filter((t) => t.owner_id === user?.id || t.trip_members.some((m: { user_id: string; role: string }) => m.user_id === user?.id && m.role === "EDITOR"))
    .map((t) => ({ id: t.id as string, title: t.title as string, days: Math.round((+new Date(t.end_date) - +new Date(t.start_date)) / 86_400_000) + 1 }));
  const { data: nearbyRows } = await sb.from("destinations").select("*").neq("city", d.city).eq("region", d.region).neq("id", d.id).order("rating", { ascending: false }).limit(3);
  const nearby = (nearbyRows ?? []).map(destinationOut);

  return (
    <div className="space-y-5">
      <Link href="/destinations" className="text-sm text-brand-600">← Tất cả điểm đến</Link>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div>
            <h1 className="text-3xl font-bold">{d.name}</h1>
            <p className="text-slate-500">{d.city} · {d.region} · {d.category?.name}</p>
          </div>
          <p className="text-slate-700">{d.description}</p>
          <div className="flex gap-6 text-sm">
            <span className="text-amber-600">★ {d.rating.toFixed(1)}</span>
            <span>Chi phí ước tính: <b>{vnd(d.avgCost)}</b>/người</span>
          </div>
          {user ? (
            <AddToTrip destinationId={d.id} trips={trips} />
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
    </div>
  );
}

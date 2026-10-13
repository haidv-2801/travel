import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSharedTrip } from "@/lib/shared";
import { getSession } from "@/lib/auth";
import { ItineraryView } from "@/components/itinerary-view";
import { TripMap } from "@/components/map-dynamic";
import { PrintButton } from "@/components/print-button";
import { CloneButton } from "@/components/clone-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharedTrip({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const trip = await loadSharedTrip(token);
  if (!trip) notFound();
  const session = await getSession();
  const points = trip.items.map((i, n) => ({ lat: i.destination.lat, lng: i.destination.lng, label: `Ngày ${i.day}: ${i.destination.name}`, order: n + 1 }));
  const byDay = new Map<number, [number, number][]>();
  trip.items.forEach((i) => byDay.set(i.day, [...(byDay.get(i.day) ?? []), [i.destination.lat, i.destination.lng]]));
  const lines = [...byDay.values()].filter((l) => l.length > 1).map((positions) => ({ positions, dashed: true }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-sm text-slate-500">Chia sẻ bởi {trip.user.name} · {trip.days} ngày · {new Date(trip.startDate).toLocaleDateString("vi-VN")} – {new Date(trip.endDate).toLocaleDateString("vi-VN")}</p>
        </div>
        <div className="flex gap-2"><PrintButton /><CloneButton token={token} loggedIn={!!session} /></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3"><ItineraryView title={trip.title} startDate={trip.startDate} days={trip.days} items={trip.items} /></div>
        <div className="no-print lg:col-span-2"><TripMap points={points} lines={lines} height={380} /></div>
      </div>
    </div>
  );
}

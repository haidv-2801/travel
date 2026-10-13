import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { vnd } from "@/lib/api";
import { tripDays } from "@/lib/trips";
import { ItineraryView } from "@/components/itinerary-view";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

/** Owner-only printable view: use the browser's "Save as PDF". */
export default async function PrintTrip({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const trip = await db.trip.findFirst({
    where: { id, userId: user.id },
    include: { items: { orderBy: [{ day: "asc" }, { position: "asc" }], include: { destination: true } }, expenses: true },
  });
  if (!trip) notFound();
  const planned = trip.expenses.reduce((s, e) => s + e.planned, 0);
  const actual = trip.expenses.reduce((s, e) => s + e.actual, 0);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-sm text-slate-500">{new Date(trip.startDate).toLocaleDateString("vi-VN")} – {new Date(trip.endDate).toLocaleDateString("vi-VN")} · Ngân sách {vnd(trip.budget)} · Dự kiến {vnd(planned)} · Thực tế {vnd(actual)}</p>
        </div>
        <PrintButton />
      </div>
      <ItineraryView title={trip.title} startDate={trip.startDate} days={tripDays(trip.startDate, trip.endDate)} items={trip.items} />
    </div>
  );
}

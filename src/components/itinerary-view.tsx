import { vnd } from "@/lib/api";

type Item = { id: string; day: number; note: string | null; destination: { name: string; city: string; avgCost: number } };
const fmt = (d: Date) => new Date(d).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });

/** Server-safe read-only itinerary used by the public share page and the PDF/print view. */
export function ItineraryView({ title, startDate, days, items }: { title: string; startDate: Date; days: number; items: Item[] }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const list = items.filter((x) => x.day === day);
        const date = new Date(new Date(startDate).getTime() + i * 86_400_000);
        return (
          <section key={day} className="card">
            <h3 className="mb-2 font-semibold">Ngày {day} <span className="text-xs font-normal text-slate-500">· {fmt(date)}</span></h3>
            {list.length === 0 ? <p className="text-sm text-slate-400">Chưa có địa điểm.</p> : (
              <ol className="space-y-1.5 text-sm">
                {list.map((x, n) => (
                  <li key={x.id} className="flex gap-2">
                    <span className="w-5 text-slate-400">{n + 1}.</span>
                    <span><b>{x.destination.name}</b> <span className="text-slate-500">· {x.destination.city} · ~{vnd(x.destination.avgCost)}/người</span>{x.note && <em className="block text-slate-500">{x.note}</em>}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
      <span className="sr-only">{title}</span>
    </div>
  );
}

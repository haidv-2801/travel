"use client";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, vnd } from "@/lib/api";
import { distanceKm } from "@/lib/geo";
import { DayBoard, type Item } from "@/components/day-board";
import { BudgetPanel, type Expense } from "@/components/budget-panel";
import { TripMap } from "@/components/map-dynamic";
import { SharePanel } from "@/components/share-panel";

type Trip = { id: string; title: string; startDate: string; endDate: string; budget: number; shareToken: string | null; days: number; items: Item[]; expenses: Expense[] };
type Dest = { id: string; name: string; city: string };

export default function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const key = useMemo(() => ["trip", id], [id]);
  const [tab, setTab] = useState<"plan" | "budget">("plan");
  const [mapDay, setMapDay] = useState(0); // 0 = all days
  const [q, setQ] = useState("");
  const [addDay, setAddDay] = useState(1);

  const { data: trip, error } = useQuery({ queryKey: key, queryFn: () => api<Trip>(`/api/trips/${id}`) });
  const { data: results } = useQuery({
    queryKey: ["dest-search", q],
    queryFn: () => api<{ items: Dest[] }>(`/api/destinations?pageSize=6&q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const addItem = useMutation({ mutationFn: (destinationId: string) => api(`/api/trips/${id}/items`, { method: "POST", body: { destinationId, day: addDay } }), onSuccess: refresh });
  const removeItem = useMutation({ mutationFn: (itemId: string) => api(`/api/trips/${id}/items/${itemId}`, { method: "DELETE" }), onSuccess: refresh });
  const reorder = useMutation({
    mutationFn: (items: { id: string; day: number; position: number }[]) => api(`/api/trips/${id}/items`, { method: "PATCH", body: { items } }),
    onSuccess: refresh,
  });
  const addExpense = useMutation({ mutationFn: (e: Omit<Expense, "id">) => api(`/api/trips/${id}/expenses`, { method: "POST", body: e }), onSuccess: refresh });
  const updExpense = useMutation({ mutationFn: ({ eid, patch }: { eid: string; patch: Partial<Expense> }) => api(`/api/trips/${id}/expenses/${eid}`, { method: "PATCH", body: patch }), onSuccess: refresh });
  const delExpense = useMutation({ mutationFn: (eid: string) => api(`/api/trips/${id}/expenses/${eid}`, { method: "DELETE" }), onSuccess: refresh });
  const setBudget = useMutation({ mutationFn: (budget: number) => api(`/api/trips/${id}`, { method: "PATCH", body: { budget } }), onSuccess: refresh });

  const sorted = useMemo(() => [...(trip?.items ?? [])].sort((a, b) => a.day - b.day || a.position - b.position), [trip]);
  const shown = mapDay === 0 ? sorted : sorted.filter((i) => i.day === mapDay);
  const points = shown.map((i, n) => ({ lat: i.destination.lat, lng: i.destination.lng, label: `Ngày ${i.day}: ${i.destination.name}`, order: n + 1 }));
  const byDay = useMemo(() => {
    const m = new Map<number, Item[]>();
    sorted.forEach((i) => m.set(i.day, [...(m.get(i.day) ?? []), i]));
    return [...m.entries()].filter(([d]) => mapDay === 0 || d === mapDay).sort((x, y) => x[0] - y[0]);
  }, [sorted, mapDay]);
  // Real driving routes per day (OSRM via /api/route); falls back to straight dashed lines if unavailable.
  const routable = byDay.filter(([, l]) => l.length > 1);
  const routeQueries = useQueries({
    queries: routable.map(([, l]) => {
      const pts = l.map((i) => `${i.destination.lat},${i.destination.lng}`).join(";");
      return { queryKey: ["route", pts], queryFn: () => api<{ distanceKm: number; durationMin: number; geometry: [number, number][] }>(`/api/route?points=${pts}`), retry: false, staleTime: 3_600_000 };
    }),
  });
  const legs = byDay.map(([day, list]) => {
    const idx = routable.findIndex(([d]) => d === day);
    const r = idx >= 0 ? routeQueries[idx]?.data : undefined;
    let km = 0;
    for (let n = 1; n < list.length; n++) km += distanceKm([list[n - 1].destination.lat, list[n - 1].destination.lng], [list[n].destination.lat, list[n].destination.lng]);
    return { day, km: r?.distanceKm ?? km, minutes: r?.durationMin ?? null, real: !!r, geometry: r?.geometry, straight: list.map((i) => [i.destination.lat, i.destination.lng] as [number, number]) };
  });
  const lines = legs.filter((l) => l.straight.length > 1).map((l) => (l.geometry ? { positions: l.geometry } : { positions: l.straight, dashed: true }));

  if (error) return <p className="text-red-600">{(error as Error).message}. <Link className="underline" href="/trips">Quay lại</Link></p>;
  if (!trip) return <p className="text-slate-500">Đang tải…</p>;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/trips" className="text-sm text-brand-600">← Chuyến đi</Link>
        <h1 className="text-2xl font-bold">{trip.title}</h1>
        <p className="text-sm text-slate-500">{new Date(trip.startDate).toLocaleDateString("vi-VN")} – {new Date(trip.endDate).toLocaleDateString("vi-VN")} · {trip.days} ngày · Ngân sách {vnd(trip.budget)}</p>
      </div>
      <SharePanel tripId={trip.id} initialToken={trip.shareToken} />
      <div className="flex gap-2">
        {(["plan", "budget"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-sm ${tab === t ? "bg-brand-600 text-white" : "bg-white border"}`}>{t === "plan" ? "Lịch trình" : "Ngân sách"}</button>
        ))}
      </div>

      {tab === "budget" ? (
        <BudgetPanel budget={trip.budget} expenses={trip.expenses} onAdd={(e) => addExpense.mutateAsync(e)} onUpdate={(eid, patch) => updExpense.mutate({ eid, patch })} onDelete={(eid) => delExpense.mutate(eid)} onBudget={(b) => setBudget.mutate(b)} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="card space-y-2">
              <div className="flex gap-2">
                <input className="input" placeholder="Tìm địa điểm để thêm…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="input w-32" value={addDay} onChange={(e) => setAddDay(Number(e.target.value))}>
                  {Array.from({ length: trip.days }, (_, i) => <option key={i} value={i + 1}>Ngày {i + 1}</option>)}
                </select>
              </div>
              {results?.items.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <span>{d.name} <span className="text-xs text-slate-500">· {d.city}</span></span>
                  <button className="btn-ghost" onClick={() => { addItem.mutate(d.id); setQ(""); }}>+ Thêm</button>
                </div>
              ))}
              {addItem.error && <p className="text-sm text-red-600">{(addItem.error as Error).message}</p>}
            </div>
            <DayBoard items={trip.items} days={trip.days} onChange={(l) => reorder.mutate(l)} onRemove={(iid) => removeItem.mutate(iid)} />
          </div>
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-center gap-2">
              <label className="label !mb-0">Bản đồ:</label>
              <select className="input w-40" value={mapDay} onChange={(e) => setMapDay(Number(e.target.value))}>
                <option value={0}>Tất cả ngày</option>
                {Array.from({ length: trip.days }, (_, i) => <option key={i} value={i + 1}>Ngày {i + 1}</option>)}
              </select>
            </div>
            <TripMap points={points} lines={lines} height={380} />
            <div className="card text-sm">
              <h3 className="mb-1 font-semibold">Quãng đường</h3>
              {legs.length === 0 ? <p className="text-slate-400">Chưa có địa điểm.</p> : legs.map((l) => (
                <div key={l.day} className="flex justify-between"><span>Ngày {l.day}</span><span>{l.km.toFixed(1)} km{l.minutes != null && ` · ${Math.floor(l.minutes / 60)}h${String(l.minutes % 60).padStart(2, "0")}`}{!l.real && l.straight.length > 1 && <span className="text-slate-400"> (chim bay)</span>}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

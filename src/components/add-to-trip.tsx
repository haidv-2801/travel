"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export function AddToTrip({ destinationId, trips }: { destinationId: string; trips: { id: string; title: string; days: number }[] }) {
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const [day, setDay] = useState(1);
  const [msg, setMsg] = useState("");
  const trip = trips.find((t) => t.id === tripId);

  if (trips.length === 0) return <p className="text-sm text-slate-500">Bạn chưa có chuyến đi nào. <Link className="text-brand-600 underline" href="/trips">Tạo chuyến đi</Link></p>;

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Thêm vào chuyến đi</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Chuyến đi</label>
          <select className="input" value={tripId} onChange={(e) => { setTripId(e.target.value); setDay(1); }}>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Ngày</label>
          <select className="input" value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {Array.from({ length: trip?.days ?? 1 }, (_, i) => <option key={i} value={i + 1}>Ngày {i + 1}</option>)}
          </select>
        </div>
        <button
          className="btn"
          onClick={async () => {
            try {
              await api(`/api/trips/${tripId}/items`, { method: "POST", body: { destinationId, day } });
              setMsg("Đã thêm ✓");
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          Thêm
        </button>
      </div>
      {msg && <p className="text-sm text-slate-600">{msg} {msg.startsWith("Đã") && <Link className="text-brand-600 underline" href={`/trips/${tripId}`}>Xem lịch trình</Link>}</p>}
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api, vnd } from "@/lib/api";

type TripRow = { id: string; title: string; startDate: string; endDate: string; budget: number; days: number; shared?: boolean; _count: { items: number } };
type FormValues = { title: string; startDate: string; endDate: string; budget: number };

export default function TripsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [error, setError] = useState("");
  const { data: trips, isLoading } = useQuery({ queryKey: ["trips"], queryFn: () => api<TripRow[]>("/api/trips") });
  const { register, handleSubmit, reset } = useForm<FormValues>({ defaultValues: { budget: 0 } });

  const create = useMutation({
    mutationFn: (v: FormValues) => api<{ id: string }>("/api/trips", { method: "POST", body: { ...v, budget: Number(v.budget) || 0 } }),
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ["trips"] }); reset(); router.push(`/trips/${t.id}`); },
    onError: (e: Error) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/trips/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Chuyến đi của tôi</h1>
      <form className="card grid gap-3 sm:grid-cols-5" onSubmit={handleSubmit((v) => { setError(""); create.mutate(v); })}>
        <div className="sm:col-span-2"><label className="label">Tên chuyến đi</label><input className="input" required {...register("title")} placeholder="Đà Nẵng - Hội An 4 ngày" /></div>
        <div><label className="label">Ngày đi</label><input className="input" type="date" required {...register("startDate")} /></div>
        <div><label className="label">Ngày về</label><input className="input" type="date" required {...register("endDate")} /></div>
        <div><label className="label">Ngân sách (₫)</label><input className="input" type="number" min={0} step={100000} {...register("budget")} /></div>
        <div className="sm:col-span-5 flex items-center gap-3">
          <button className="btn" disabled={create.isPending}>Tạo chuyến đi</button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>

      {isLoading && <p className="text-slate-500">Đang tải…</p>}
      {trips?.length === 0 && <p className="text-slate-500">Chưa có chuyến đi nào. Hãy tạo chuyến đi đầu tiên!</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trips?.map((t) => (
          <div key={t.id} className="card">
            <Link href={`/trips/${t.id}`} className="block">
              <h2 className="font-semibold hover:text-brand-600">{t.title} {t.shared && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-normal text-brand-600">Được mời</span>}</h2>
              <p className="text-xs text-slate-500">{new Date(t.startDate).toLocaleDateString("vi-VN")} – {new Date(t.endDate).toLocaleDateString("vi-VN")} · {t.days} ngày</p>
              <p className="mt-2 text-sm">{t._count.items} địa điểm · Ngân sách {vnd(t.budget)}</p>
            </Link>
            {!t.shared && <button className="btn-danger mt-2" onClick={() => confirm("Xoá chuyến đi này?") && remove.mutate(t.id)}>Xoá</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

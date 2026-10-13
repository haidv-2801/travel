"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type N = { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ items: N[]; unread: number }>("/api/notifications"), refetchInterval: 120_000, refetchOnWindowFocus: true });
  const markRead = useMutation({ mutationFn: () => api("/api/notifications/read", { method: "POST" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });

  return (
    <div className="relative">
      <button aria-label="Thông báo" className="relative px-1 text-lg" onClick={() => { setOpen(!open); if (!open && data?.unread) markRead.mutate(); }}>
        🔔
        {!!data?.unread && <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl border bg-white p-2 shadow-lg">
          {data?.items.length ? data.items.map((n) => (
            <Link key={n.id} href={n.href ?? "#"} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
              <div className={n.readAt ? "" : "font-semibold"}>{n.title}</div>
              <div className="text-xs text-slate-500">{n.body}</div>
            </Link>
          )) : <p className="p-3 text-center text-sm text-slate-400">Chưa có thông báo</p>}
        </div>
      )}
    </div>
  );
}

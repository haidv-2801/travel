"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Comment = { id: string; body: string; createdAt: string; userId: string; user: { name: string } };

export function ItemDiscussion({ tripId, itemId, me, isOwner, canWrite }: { tripId: string; itemId: string; me?: string; isOwner: boolean; canWrite: boolean }) {
  const qc = useQueryClient();
  const key = ["item-comments", itemId];
  const [text, setText] = useState("");
  const { data, error } = useQuery({ queryKey: key, queryFn: () => api<Comment[]>(`/api/trips/${tripId}/items/${itemId}/comments`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["trip", tripId] }); };
  const add = useMutation({ mutationFn: (body: string) => api(`/api/trips/${tripId}/items/${itemId}/comments`, { method: "POST", body: { body } }), onSuccess: () => { setText(""); refresh(); } });
  const del = useMutation({ mutationFn: (id: string) => api(`/api/trips/${tripId}/comments/${id}`, { method: "DELETE" }), onSuccess: refresh });
  const err = (error ?? add.error ?? del.error) as Error | null;

  return (
    <div className="mt-2 space-y-2 border-t pt-2">
      {data?.length === 0 && <p className="text-xs text-slate-400">Chưa có bình luận.</p>}
      <ul className="space-y-1">
        {data?.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2 text-xs">
            <span className="min-w-0 break-words"><b>{c.user.name}</b> {c.body} <span className="text-slate-400">{new Date(c.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span></span>
            {(c.userId === me || isOwner) && <button className="text-slate-400 hover:text-red-600" aria-label="Xoá bình luận" onClick={() => del.mutate(c.id)}>✕</button>}
          </li>
        ))}
      </ul>
      {canWrite && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) add.mutate(text.trim()); }}>
          <input className="input !py-1 text-xs" maxLength={500} placeholder="Viết bình luận…" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-ghost" disabled={add.isPending || !text.trim()}>Gửi</button>
        </form>
      )}
      {err && <p className="text-xs text-red-600">{err.message}</p>}
    </div>
  );
}

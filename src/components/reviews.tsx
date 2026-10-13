"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Review = { id: string; rating: number; comment: string; imageUrl: string | null; createdAt: string; userId: string; user: { name: string } };
const Stars = ({ n }: { n: number }) => <span className="text-amber-500" aria-label={`${n} sao`}>{"★".repeat(n)}<span className="text-slate-300">{"★".repeat(5 - n)}</span></span>;

export function Reviews({ destinationId, user }: { destinationId: string; user: { id: string; role: string } | null }) {
  const qc = useQueryClient();
  const router = useRouter();
  const key = ["reviews", destinationId];
  const { data } = useQuery({ queryKey: key, queryFn: () => api<{ items: Review[]; total: number }>(`/api/destinations/${destinationId}/reviews`) });
  const mine = data?.items.find((r) => r.userId === user?.id);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState("");

  const done = () => { qc.invalidateQueries({ queryKey: key }); router.refresh(); }; // refresh server-rendered avg rating
  const save = useMutation({
    mutationFn: () => api(`/api/destinations/${destinationId}/reviews`, { method: "POST", body: { rating, comment, imageUrl: imageUrl || null } }),
    onSuccess: () => { setComment(""); setImageUrl(""); setError(""); done(); },
    onError: (e: Error) => setError(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => api(`/api/reviews/${id}`, { method: "DELETE" }), onSuccess: done });

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Đánh giá ({data?.total ?? 0})</h2>
      {user ? (
        <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <p className="text-sm font-medium">{mine ? "Cập nhật đánh giá của bạn" : "Viết đánh giá"}</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Số sao">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} role="radio" aria-checked={rating === n} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? "text-amber-500" : "text-slate-300"}`}>★</button>
            ))}
          </div>
          <textarea className="input" rows={3} required maxLength={1000} placeholder="Chia sẻ trải nghiệm của bạn…" value={comment} onChange={(e) => setComment(e.target.value)} />
          <input className="input" type="url" placeholder="Link ảnh (https://…, tuỳ chọn)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn" disabled={save.isPending}>{mine ? "Cập nhật" : "Gửi đánh giá"}</button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">Đăng nhập để viết đánh giá.</p>
      )}
      <ul className="space-y-3">
        {data?.items.map((r) => (
          <li key={r.id} className="card">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.user.name} <Stars n={r.rating} /></span>
              <span className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleDateString("vi-VN")}</span>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.comment}</p>
            {r.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.imageUrl} alt="Ảnh đánh giá" loading="lazy" referrerPolicy="no-referrer" className="mt-2 max-h-48 rounded-lg" />
            )}
            {(user?.id === r.userId || user?.role === "ADMIN") && <button className="btn-danger mt-1" onClick={() => confirm("Xoá đánh giá?") && del.mutate(r.id)}>Xoá</button>}
          </li>
        ))}
        {data?.items.length === 0 && <li className="text-sm text-slate-400">Chưa có đánh giá nào.</li>}
      </ul>
    </section>
  );
}

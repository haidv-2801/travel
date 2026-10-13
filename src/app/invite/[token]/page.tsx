"use client";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Invite = { tripId: string; title: string; startDate: string; endDate: string; owner: string; role: "EDITOR" | "VIEWER"; alreadyMember: boolean };

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { data, error } = useQuery({ queryKey: ["invite", token], queryFn: () => api<Invite>(`/api/invites/${token}`), retry: false });
  const join = useMutation({
    mutationFn: () => api<{ tripId: string }>(`/api/invites/${token}/join`, { method: "POST" }),
    onSuccess: (r) => router.push(`/trips/${r.tripId}`),
  });

  if (error) return <p className="text-red-600">{(error as Error).message}. <Link className="underline" href="/trips">Về chuyến đi của tôi</Link></p>;
  if (!data) return <p className="text-slate-500">Đang tải…</p>;
  return (
    <div className="card mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-bold">Lời mời tham gia chuyến đi</h1>
      <div>
        <div className="font-semibold">{data.title}</div>
        <p className="text-sm text-slate-500">{new Date(data.startDate).toLocaleDateString("vi-VN")} – {new Date(data.endDate).toLocaleDateString("vi-VN")} · của {data.owner}</p>
      </div>
      <p className="text-sm">Bạn sẽ tham gia với quyền <b>{data.role === "EDITOR" ? "chỉnh sửa" : "chỉ xem"}</b>.</p>
      {data.alreadyMember ? <Link className="btn" href={`/trips/${data.tripId}`}>Bạn đã ở trong chuyến đi — mở</Link> : <button className="btn" disabled={join.isPending} onClick={() => join.mutate()}>Tham gia chuyến đi</button>}
      {join.error && <p className="text-sm text-red-600">{(join.error as Error).message}</p>}
    </div>
  );
}

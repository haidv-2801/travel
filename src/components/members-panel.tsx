"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Member = { userId: string; role: "EDITOR" | "VIEWER"; user: { name: string; email: string } };
type Role = Member["role"];
const ROLE_LABEL: Record<Role, string> = { EDITOR: "Chỉnh sửa", VIEWER: "Chỉ xem" };

export function MembersPanel({ tripId, myId, myRole, owner, members, inviteToken, inviteRole }: {
  tripId: string; myId: string; myRole: "OWNER" | Role; owner: { name: string };
  members: Member[]; inviteToken?: string | null; inviteRole?: Role;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const isOwner = myRole === "OWNER";
  const [role, setRole] = useState<Role>(inviteRole ?? "EDITOR");
  const [copied, setCopied] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["trip", tripId] });

  const invite = useMutation({ mutationFn: (v: { enabled: boolean; role: Role }) => api(`/api/trips/${tripId}/invite`, { method: "POST", body: v }), onSuccess: refresh });
  const setMemberRole = useMutation({ mutationFn: (v: { userId: string; role: Role }) => api(`/api/trips/${tripId}/members/${v.userId}`, { method: "PATCH", body: { role: v.role } }), onSuccess: refresh });
  const removeMember = useMutation({ mutationFn: (userId: string) => api(`/api/trips/${tripId}/members/${userId}`, { method: "DELETE" }), onSuccess: refresh });
  const leave = useMutation({ mutationFn: () => api(`/api/trips/${tripId}/members/${myId}`, { method: "DELETE" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["trips"] }); router.push("/trips"); } });

  const url = inviteToken ? `${typeof location === "undefined" ? "" : location.origin}/invite/${inviteToken}` : "";
  const err = (invite.error ?? setMemberRole.error ?? removeMember.error ?? leave.error) as Error | null;

  return (
    <div className="card space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Thành viên</span>
        {!isOwner && <button className="btn-danger" onClick={() => confirm("Rời khỏi chuyến đi này?") && leave.mutate()}>Rời chuyến đi</button>}
      </div>
      <ul className="space-y-1">
        <li className="flex justify-between"><span>{owner.name}</span><span className="text-xs text-slate-500">Chủ chuyến đi</span></li>
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{m.user.name} <span className="text-xs text-slate-500">· {m.user.email}</span></span>
            {isOwner ? (
              <span className="flex items-center gap-2">
                <select className="input !w-auto !py-1" value={m.role} onChange={(e) => setMemberRole.mutate({ userId: m.userId, role: e.target.value as Role })}>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                <button className="btn-danger" onClick={() => confirm(`Xoá ${m.user.name} khỏi chuyến đi?`) && removeMember.mutate(m.userId)}>Xoá</button>
              </span>
            ) : <span className="text-xs text-slate-500">{ROLE_LABEL[m.role]}</span>}
          </li>
        ))}
      </ul>
      {isOwner && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span>Mời bằng link với quyền</span>
            <select className="input !w-auto !py-1" value={role} onChange={(e) => { const r = e.target.value as Role; setRole(r); if (inviteToken) invite.mutate({ enabled: true, role: r }); }}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <button className="btn-ghost" disabled={invite.isPending} onClick={() => invite.mutate({ enabled: !inviteToken, role })}>{inviteToken ? "Tắt link mời" : "Tạo link mời"}</button>
          </div>
          {inviteToken && (
            <>
              <div className="flex gap-2">
                <input readOnly className="input" value={url} onFocus={(e) => e.target.select()} />
                <button className="btn-ghost" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Đã chép ✓" : "Sao chép"}</button>
              </div>
              <p className="text-xs text-slate-500">Người có link phải đăng nhập rồi bấm tham gia. Tắt link mời để vô hiệu hoá link; thành viên đã vào vẫn giữ quyền.</p>
            </>
          )}
        </div>
      )}
      {err && <p className="text-red-600">{err.message}</p>}
    </div>
  );
}

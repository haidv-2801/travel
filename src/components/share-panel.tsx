"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";

export function SharePanel({ tripId, initialToken }: { tripId: string; initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = token ? `${typeof location === "undefined" ? "" : location.origin}/s/${token}` : "";

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    try { setToken((await api<{ shareToken: string | null }>(`/api/trips/${tripId}/share`, { method: "POST", body: { enabled } })).shareToken); } finally { setBusy(false); }
  };

  return (
    <div className="card space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Chia sẻ</span>
        <Link href={`/trips/${tripId}/print`} target="_blank" className="btn-ghost">🖨️ Xuất PDF</Link>
        <button className="btn-ghost" disabled={busy} onClick={() => toggle(!token)}>{token ? "Tắt chia sẻ" : "Tạo link chia sẻ"}</button>
      </div>
      {token && (
        <div className="flex gap-2">
          <input readOnly className="input" value={url} onFocus={(e) => e.target.select()} />
          <button className="btn-ghost" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Đã chép ✓" : "Sao chép"}</button>
        </div>
      )}
      {token && <p className="text-xs text-slate-500">Bất kỳ ai có link đều xem được lịch trình (không thấy chi phí). Tắt chia sẻ để vô hiệu hoá link.</p>}
    </div>
  );
}

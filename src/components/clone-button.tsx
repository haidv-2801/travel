"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function CloneButton({ token, loggedIn }: { token: string; loggedIn: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  return (
    <span className="no-print">
      <button className="btn" onClick={async () => {
        if (!loggedIn) return router.push(`/login?next=/s/${token}`);
        try { const t = await api<{ id: string }>(`/api/shared/${token}/clone`, { method: "POST" }); router.push(`/trips/${t.id}`); } catch (e) { setErr((e as Error).message); }
      }}>Sao chép về tài khoản của tôi</button>
      {err && <span className="ml-2 text-sm text-red-600">{err}</span>}
    </span>
  );
}

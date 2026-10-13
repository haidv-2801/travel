"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function FavoriteButton({ destinationId, initial, loggedIn }: { destinationId: string; initial: boolean; loggedIn: boolean }) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      className="btn-ghost"
      disabled={busy}
      aria-pressed={fav}
      onClick={async () => {
        if (!loggedIn) return router.push(`/login?next=${location.pathname}`);
        setBusy(true);
        const next = !fav;
        setFav(next); // optimistic
        try {
          await (next ? api("/api/favorites", { method: "POST", body: { destinationId } }) : api(`/api/favorites/${destinationId}`, { method: "DELETE" }));
        } catch {
          setFav(!next);
        } finally {
          setBusy(false);
        }
      }}
    >
      {fav ? "❤️ Đã lưu" : "🤍 Lưu địa điểm"}
    </button>
  );
}

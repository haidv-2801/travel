"use client";
import dynamic from "next/dynamic";

export const TripMap = dynamic(() => import("./map"), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-pulse rounded-xl bg-slate-200" />,
});

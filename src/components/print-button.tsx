"use client";
export function PrintButton({ label = "Lưu PDF / In" }: { label?: string }) {
  return <button className="btn-ghost no-print" onClick={() => window.print()}>🖨️ {label}</button>;
}

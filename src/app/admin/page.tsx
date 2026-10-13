"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, vnd } from "@/lib/api";

type Cat = { id: string; name: string; slug: string };
type Dest = { id: string; name: string; slug: string; city: string; region: string; avgCost: number; category: Cat };
type UserRow = { id: string; email: string; name: string; role: "USER" | "ADMIN"; _count: { trips: number } };

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const empty = { name: "", description: "", city: "", region: "Miền Bắc", lat: "", lng: "", avgCost: "0", categoryId: "" };

export default function AdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"dest" | "cat" | "users">("dest");
  const [form, setForm] = useState(empty);
  const [catName, setCatName] = useState("");
  const [error, setError] = useState("");

  const cats = useQuery({ queryKey: ["cats"], queryFn: () => api<Cat[]>("/api/categories") });
  const dests = useQuery({ queryKey: ["admin-dests"], queryFn: () => api<{ items: Dest[] }>("/api/destinations?pageSize=50") });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<UserRow[]>("/api/admin/users"), enabled: tab === "users" });
  const onErr = (e: Error) => setError(e.message);

  const addDest = useMutation({
    mutationFn: () => api("/api/destinations", { method: "POST", body: { ...form, slug: slugify(form.name), lat: Number(form.lat), lng: Number(form.lng), avgCost: Number(form.avgCost) || 0, categoryId: form.categoryId || cats.data?.[0]?.id } }),
    onSuccess: () => { setForm(empty); setError(""); qc.invalidateQueries({ queryKey: ["admin-dests"] }); }, onError: onErr,
  });
  const delDest = useMutation({ mutationFn: (id: string) => api(`/api/destinations/${id}`, { method: "DELETE" }), onSuccess: () => { setError(""); qc.invalidateQueries({ queryKey: ["admin-dests"] }); }, onError: onErr });
  const addCat = useMutation({ mutationFn: () => api("/api/categories", { method: "POST", body: { name: catName, slug: slugify(catName) } }), onSuccess: () => { setCatName(""); setError(""); qc.invalidateQueries({ queryKey: ["cats"] }); }, onError: onErr });
  const setRole = useMutation({ mutationFn: (v: { id: string; role: string }) => api(`/api/admin/users/${v.id}`, { method: "PATCH", body: { role: v.role } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }), onError: onErr });

  const f = (k: keyof typeof empty) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Quản trị</h1>
      <div className="flex gap-2">
        {([["dest", "Địa điểm"], ["cat", "Danh mục"], ["users", "Người dùng"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => { setTab(t); setError(""); }} className={`rounded-lg px-4 py-1.5 text-sm ${tab === t ? "bg-brand-600 text-white" : "border bg-white"}`}>{l}</button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === "dest" && (
        <>
          <form className="card grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); addDest.mutate(); }}>
            <div className="sm:col-span-2"><label className="label">Tên</label><input className="input" required {...f("name")} /></div>
            <div><label className="label">Thành phố</label><input className="input" required {...f("city")} /></div>
            <div><label className="label">Vùng</label><select className="input" {...f("region")}>{["Miền Bắc", "Miền Trung", "Tây Nguyên", "Miền Nam"].map((r) => <option key={r}>{r}</option>)}</select></div>
            <div><label className="label">Vĩ độ</label><input className="input" type="number" step="any" required {...f("lat")} /></div>
            <div><label className="label">Kinh độ</label><input className="input" type="number" step="any" required {...f("lng")} /></div>
            <div><label className="label">Chi phí/người (₫)</label><input className="input" type="number" min={0} {...f("avgCost")} /></div>
            <div><label className="label">Danh mục</label><select className="input" {...f("categoryId")}>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div className="sm:col-span-4"><label className="label">Mô tả</label><textarea className="input" rows={2} required {...f("description")} /></div>
            <div className="sm:col-span-4"><button className="btn" disabled={addDest.isPending}>Thêm địa điểm</button></div>
          </form>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-2">Tên</th><th>Thành phố</th><th>Danh mục</th><th>Chi phí</th><th /></tr></thead>
              <tbody>{dests.data?.items.map((d) => (
                <tr key={d.id} className="border-t"><td className="p-2">{d.name}</td><td>{d.city}</td><td>{d.category.name}</td><td>{vnd(d.avgCost)}</td>
                  <td><button className="btn-danger" onClick={() => confirm(`Xoá ${d.name}?`) && delDest.mutate(d.id)}>Xoá</button></td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}

      {tab === "cat" && (
        <div className="card space-y-3">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addCat.mutate(); }}>
            <input className="input" placeholder="Tên danh mục" required value={catName} onChange={(e) => setCatName(e.target.value)} />
            <button className="btn">Thêm</button>
          </form>
          <ul className="divide-y text-sm">{cats.data?.map((c) => <li key={c.id} className="py-2">{c.name} <span className="text-xs text-slate-400">/{c.slug}</span></li>)}</ul>
        </div>
      )}

      {tab === "users" && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-2">Tên</th><th>Email</th><th>Chuyến đi</th><th>Quyền</th></tr></thead>
            <tbody>{users.data?.map((u) => (
              <tr key={u.id} className="border-t"><td className="p-2">{u.name}</td><td>{u.email}</td><td>{u._count.trips}</td>
                <td><select className="input w-28" value={u.role} onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value })}><option>USER</option><option>ADMIN</option></select></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

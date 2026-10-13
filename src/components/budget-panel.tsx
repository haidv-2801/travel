"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { vnd } from "@/lib/api";
import { EXPENSE_CATEGORIES } from "@/lib/validators";
import { balances, settle } from "@/lib/split";

export type Expense = { id: string; title: string; category: (typeof EXPENSE_CATEGORIES)[number]; planned: number; actual: number; paidById?: string | null; splitAmong?: string[] };
export type Person = { id: string; name: string };
const LABEL: Record<string, string> = { transport: "Di chuyển", food: "Ăn uống", lodging: "Lưu trú", tickets: "Vé tham quan", other: "Khác" };
const COLORS = ["#0891b2", "#f59e0b", "#6366f1", "#10b981", "#94a3b8"];

export function BudgetPanel({ budget, expenses, people, onAdd, onUpdate, onDelete, onBudget }: {
  budget: number; expenses: Expense[]; people: Person[];
  onAdd: (e: Omit<Expense, "id">) => Promise<unknown>;
  onUpdate: (id: string, patch: Partial<Expense>) => void;
  onDelete: (id: string) => void;
  onBudget: (b: number) => void;
}) {
  const [form, setForm] = useState({ title: "", category: "food" as Expense["category"], planned: 0, actual: 0, paidById: "", splitAmong: [] as string[] });
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "?";
  const net = balances(expenses.map((e) => ({ actual: e.actual, paidById: e.paidById ?? null, splitAmong: e.splitAmong ?? [] })), people.map((p) => p.id));
  const transfers = settle(net);
  // Empty list means "everyone"; the checkboxes show that as all ticked.
  const toggle = (cur: string[], id: string) => { const all = cur.length ? cur : people.map((p) => p.id); const next = all.includes(id) ? all.filter((x) => x !== id) : [...all, id]; return next.length === people.length ? [] : next; };
  const isShared = (cur: string[] | undefined, id: string) => !cur?.length || cur.includes(id);
  const untracked = expenses.filter((e) => e.actual > 0 && !e.paidById).length;
  const planned = expenses.reduce((s, e) => s + e.planned, 0);
  const actual = expenses.reduce((s, e) => s + e.actual, 0);
  const remaining = budget - Math.max(planned, actual);
  const byCat = EXPENSE_CATEGORIES.map((c, i) => ({
    name: LABEL[c], color: COLORS[i],
    planned: expenses.filter((e) => e.category === c).reduce((s, e) => s + e.planned, 0),
    actual: expenses.filter((e) => e.category === c).reduce((s, e) => s + e.actual, 0),
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card"><div className="label">Ngân sách</div>
          <input className="input" type="number" min={0} step={100000} defaultValue={budget} key={budget} onBlur={(e) => Number(e.target.value) !== budget && onBudget(Number(e.target.value) || 0)} /></div>
        <div className="card"><div className="label">Dự kiến</div><div className="text-lg font-semibold">{vnd(planned)}</div></div>
        <div className="card"><div className="label">Thực tế</div><div className="text-lg font-semibold">{vnd(actual)}</div></div>
        <div className={`card ${remaining < 0 ? "border-red-300 bg-red-50" : ""}`}><div className="label">Còn lại</div><div className={`text-lg font-semibold ${remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>{vnd(remaining)}</div></div>
      </div>

      {expenses.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card h-64">
            <ResponsiveContainer><PieChart><Pie data={byCat.filter((c) => c.actual + c.planned > 0)} dataKey={actual > 0 ? "actual" : "planned"} nameKey="name" outerRadius={80} label>
              {byCat.filter((c) => c.actual + c.planned > 0).map((c) => <Cell key={c.name} fill={c.color} />)}
            </Pie><Tooltip formatter={(v) => vnd(Number(v))} /></PieChart></ResponsiveContainer>
          </div>
          <div className="card h-64">
            <ResponsiveContainer><BarChart data={byCat}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}k`} /><Tooltip formatter={(v) => vnd(Number(v))} /><Legend />
              <Bar dataKey="planned" name="Dự kiến" fill="#0891b2" /><Bar dataKey="actual" name="Thực tế" fill="#f59e0b" /></BarChart></ResponsiveContainer>
          </div>
        </div>
      )}

      {people.length > 1 && (
        <div className="card space-y-2 text-sm">
          <h3 className="font-semibold">Chia tiền nhóm</h3>
          {transfers.length === 0 ? <p className="text-slate-500">Chưa có khoản nào cần thanh toán. Chọn &ldquo;Ai trả&rdquo; và nhập số tiền thực tế cho từng khoản chi để tính ai nợ ai.</p> : (
            <ul className="space-y-1">{transfers.map((t, i) => <li key={i}><b>{name(t.from)}</b> trả cho <b>{name(t.to)}</b> <span className="font-semibold text-brand-600">{vnd(t.amount)}</span></li>)}</ul>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">{people.map((p) => <span key={p.id}>{p.name}: {net[p.id] > 0 ? "được nhận" : net[p.id] < 0 ? "cần trả" : "cân bằng"} {net[p.id] !== 0 && vnd(Math.abs(net[p.id]))}</span>)}</div>
          {untracked > 0 && <p className="text-xs text-amber-700">{untracked} khoản chi có số tiền thực tế nhưng chưa chọn người trả, nên chưa được tính.</p>}
        </div>
      )}

      <form className="card grid gap-3 sm:grid-cols-5" onSubmit={async (e) => { e.preventDefault(); await onAdd({ ...form, paidById: form.paidById || null }); setForm({ ...form, title: "", planned: 0, actual: 0 }); }}>
        <div className="sm:col-span-2"><label className="label">Khoản chi</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className="label">Loại</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Expense["category"] })}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}</select></div>
        <div><label className="label">Dự kiến</label><input className="input" type="number" min={0} value={form.planned} onChange={(e) => setForm({ ...form, planned: Number(e.target.value) })} /></div>
        <div><label className="label">Thực tế</label><input className="input" type="number" min={0} value={form.actual} onChange={(e) => setForm({ ...form, actual: Number(e.target.value) })} /></div>
        {people.length > 1 && (
          <>
            <div className="sm:col-span-2"><label className="label">Ai trả (để chia tiền)</label><select className="input" value={form.paidById} onChange={(e) => setForm({ ...form, paidById: e.target.value })}><option value="">Không theo dõi</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="sm:col-span-3"><label className="label">Chia đều cho</label><div className="flex flex-wrap gap-3 text-sm">{people.map((p) => <label key={p.id} className="flex items-center gap-1"><input type="checkbox" checked={isShared(form.splitAmong, p.id)} onChange={() => setForm({ ...form, splitAmong: toggle(form.splitAmong, p.id) })} />{p.name}</label>)}</div></div>
          </>
        )}
        <div className="sm:col-span-5"><button className="btn">Thêm khoản chi</button></div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-2">Khoản chi</th><th>Loại</th><th>Dự kiến</th><th>Thực tế</th>{people.length > 1 && <><th>Ai trả</th><th>Chia cho</th></>}<th /></tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">{e.title}</td><td>{LABEL[e.category]}</td>
                <td><input className="input w-28" type="number" min={0} defaultValue={e.planned} onBlur={(ev) => Number(ev.target.value) !== e.planned && onUpdate(e.id, { planned: Number(ev.target.value) || 0 })} /></td>
                <td><input className="input w-28" type="number" min={0} defaultValue={e.actual} onBlur={(ev) => Number(ev.target.value) !== e.actual && onUpdate(e.id, { actual: Number(ev.target.value) || 0 })} /></td>
                {people.length > 1 && (
                  <>
                    <td><select className="input w-32" value={e.paidById ?? ""} onChange={(ev) => onUpdate(e.id, { paidById: ev.target.value || null })}><option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                    <td><div className="flex flex-wrap gap-2 text-xs">{people.map((p) => <label key={p.id} className="flex items-center gap-1"><input type="checkbox" checked={isShared(e.splitAmong, p.id)} onChange={() => onUpdate(e.id, { splitAmong: toggle(e.splitAmong ?? [], p.id) })} />{p.name}</label>)}</div></td>
                  </>
                )}
                <td><button className="btn-danger" onClick={() => onDelete(e.id)}>Xoá</button></td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-400">Chưa có khoản chi nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

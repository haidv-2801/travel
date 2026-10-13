"use client";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { vnd } from "@/lib/api";
import { EXPENSE_CATEGORIES } from "@/lib/validators";

export type Expense = { id: string; title: string; category: (typeof EXPENSE_CATEGORIES)[number]; planned: number; actual: number };
const LABEL: Record<string, string> = { transport: "Di chuyển", food: "Ăn uống", lodging: "Lưu trú", tickets: "Vé tham quan", other: "Khác" };
const COLORS = ["#0891b2", "#f59e0b", "#6366f1", "#10b981", "#94a3b8"];

export function BudgetPanel({ budget, expenses, onAdd, onUpdate, onDelete, onBudget }: {
  budget: number; expenses: Expense[];
  onAdd: (e: Omit<Expense, "id">) => Promise<unknown>;
  onUpdate: (id: string, patch: Partial<Expense>) => void;
  onDelete: (id: string) => void;
  onBudget: (b: number) => void;
}) {
  const [form, setForm] = useState({ title: "", category: "food" as Expense["category"], planned: 0, actual: 0 });
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

      <form className="card grid gap-3 sm:grid-cols-5" onSubmit={async (e) => { e.preventDefault(); await onAdd(form); setForm({ ...form, title: "", planned: 0, actual: 0 }); }}>
        <div className="sm:col-span-2"><label className="label">Khoản chi</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className="label">Loại</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Expense["category"] })}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}</select></div>
        <div><label className="label">Dự kiến</label><input className="input" type="number" min={0} value={form.planned} onChange={(e) => setForm({ ...form, planned: Number(e.target.value) })} /></div>
        <div><label className="label">Thực tế</label><input className="input" type="number" min={0} value={form.actual} onChange={(e) => setForm({ ...form, actual: Number(e.target.value) })} /></div>
        <div className="sm:col-span-5"><button className="btn">Thêm khoản chi</button></div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-2">Khoản chi</th><th>Loại</th><th>Dự kiến</th><th>Thực tế</th><th /></tr></thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">{e.title}</td><td>{LABEL[e.category]}</td>
                <td><input className="input w-28" type="number" min={0} defaultValue={e.planned} onBlur={(ev) => Number(ev.target.value) !== e.planned && onUpdate(e.id, { planned: Number(ev.target.value) || 0 })} /></td>
                <td><input className="input w-28" type="number" min={0} defaultValue={e.actual} onBlur={(ev) => Number(ev.target.value) !== e.actual && onUpdate(e.id, { actual: Number(ev.target.value) || 0 })} /></td>
                <td><button className="btn-danger" onClick={() => onDelete(e.id)}>Xoá</button></td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Chưa có khoản chi nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { vnd } from "@/lib/api";
import { EXPENSE_CATEGORIES } from "@/lib/validators";
import { balances, settle } from "@/lib/split";

export type Expense = { id: string; title: string; category: (typeof EXPENSE_CATEGORIES)[number]; planned: number; actual: number; paidById?: string | null; splitAmong?: string[]; shareAmounts?: Record<string, number> | null };
export type Person = { id: string; name: string };
const LABEL: Record<string, string> = { transport: "Di chuyển", food: "Ăn uống", lodging: "Lưu trú", tickets: "Vé tham quan", other: "Khác" };

export function BudgetPanel({ budget, expenses, people, onAdd, onUpdate, onDelete, onBudget }: {
  budget: number; expenses: Expense[]; people: Person[];
  onAdd: (e: Omit<Expense, "id">) => Promise<unknown>;
  onUpdate: (id: string, patch: Partial<Expense>) => void;
  onDelete: (id: string) => void;
  onBudget: (b: number) => void;
}) {
  const [form, setForm] = useState({ title: "", category: "food" as Expense["category"], planned: 0, actual: 0, paidById: "", splitAmong: [] as string[], shareAmounts: null as Record<string, number> | null });
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "?";
  const net = balances(expenses.map((e) => ({ actual: e.actual, paidById: e.paidById ?? null, splitAmong: e.splitAmong ?? [], shareAmounts: e.shareAmounts })), people.map((p) => p.id));
  const transfers = settle(net);
  // Empty list means "everyone"; the checkboxes show that as all ticked.
  const toggle = (cur: string[], id: string) => { const all = cur.length ? cur : people.map((p) => p.id); const next = all.includes(id) ? all.filter((x) => x !== id) : [...all, id]; return next.length === people.length ? [] : next; };
  const isShared = (cur: string[] | undefined, id: string) => !cur?.length || cur.includes(id);
  const untracked = expenses.filter((e) => e.actual > 0 && !e.paidById).length;
  const planned = expenses.reduce((s, e) => s + e.planned, 0);
  const actual = expenses.reduce((s, e) => s + e.actual, 0);
  const remaining = budget - Math.max(planned, actual);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card"><div className="label">Ngân sách</div>
          <input className="input" type="number" min={0} step={100000} defaultValue={budget} key={budget} onBlur={(e) => Number(e.target.value) !== budget && onBudget(Number(e.target.value) || 0)} /></div>
        <div className="card"><div className="label">Dự kiến</div><div className="text-lg font-semibold">{vnd(planned)}</div></div>
        <div className="card"><div className="label">Thực tế</div><div className="text-lg font-semibold">{vnd(actual)}</div></div>
        <div className={`card ${remaining < 0 ? "border-red-300 bg-red-50" : ""}`}><div className="label">Còn lại</div><div className={`text-lg font-semibold ${remaining < 0 ? "text-red-600" : "text-emerald-600"}`}>{vnd(remaining)}</div></div>
      </div>

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

      <form className="card grid gap-3 sm:grid-cols-5" onSubmit={async (e) => { e.preventDefault(); await onAdd({ ...form, paidById: form.paidById || null, shareAmounts: form.shareAmounts ?? undefined }); setForm({ ...form, title: "", planned: 0, actual: 0, splitAmong: [], shareAmounts: null }); }}>
        <div className="sm:col-span-2"><label className="label">Khoản chi</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label className="label">Loại</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Expense["category"] })}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{LABEL[c]}</option>)}</select></div>
        <div><label className="label">Dự kiến</label><input className="input" type="number" min={0} value={form.planned} onChange={(e) => setForm({ ...form, planned: Number(e.target.value) })} /></div>
        <div><label className="label">Thực tế</label><input className="input" type="number" min={0} value={form.actual} onChange={(e) => setForm({ ...form, actual: Number(e.target.value) })} /></div>
        {people.length > 1 && (
          <>
            <div className="sm:col-span-2"><label className="label">Ai trả (để chia tiền)</label><select className="input" value={form.paidById} onChange={(e) => setForm({ ...form, paidById: e.target.value })}><option value="">Không theo dõi</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="sm:col-span-3">
              <label className="label">{form.shareAmounts ? "Chia theo số tiền" : "Chia đều cho"} <button type="button" className="ml-2 text-xs text-cyan-700 underline" onClick={() => setForm({ ...form, shareAmounts: form.shareAmounts ? null : equalAmounts(people.map((p) => p.id), form.actual) })}>{form.shareAmounts ? "Chia đều" : "Chia không đều"}</button></label>
              {form.shareAmounts
                ? <AmountEditor people={people} total={form.actual} value={form.shareAmounts} onChange={(v) => setForm({ ...form, shareAmounts: v })} />
                : <div className="flex flex-wrap gap-3 text-sm">{people.map((p) => <label key={p.id} className="flex items-center gap-1"><input type="checkbox" checked={isShared(form.splitAmong, p.id)} onChange={() => setForm({ ...form, splitAmong: toggle(form.splitAmong, p.id) })} />{p.name}</label>)}</div>}
            </div>
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
                <td><input className="input w-28" type="number" min={0} defaultValue={e.actual} readOnly={!!e.shareAmounts} title={e.shareAmounts ? "Đang chia theo số tiền: chuyển về chia đều để sửa số tiền" : undefined} onBlur={(ev) => Number(ev.target.value) !== e.actual && onUpdate(e.id, { actual: Number(ev.target.value) || 0 })} /></td>
                {people.length > 1 && (
                  <>
                    <td><select className="input w-32" value={e.paidById ?? ""} onChange={(ev) => onUpdate(e.id, { paidById: ev.target.value || null })}><option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                    <td>
                      {e.shareAmounts
                        ? <AmountEditor people={people} total={e.actual} value={e.shareAmounts} onSave={(v) => onUpdate(e.id, { shareAmounts: v })} onReset={() => onUpdate(e.id, { splitAmong: [] })} />
                        : <div className="flex flex-wrap items-center gap-2 text-xs">{people.map((p) => <label key={p.id} className="flex items-center gap-1"><input type="checkbox" checked={isShared(e.splitAmong, p.id)} onChange={() => onUpdate(e.id, { splitAmong: toggle(e.splitAmong ?? [], p.id) })} />{p.name}</label>)}
                          {e.actual > 0 && <button type="button" className="text-cyan-700 underline" onClick={() => onUpdate(e.id, { shareAmounts: equalAmounts((e.splitAmong?.length ? e.splitAmong : people.map((p) => p.id)), e.actual) })}>Chia không đều</button>}</div>}
                    </td>
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

/** Equal amounts in whole đồng, the remainder going 1₫ each to the first people. */
function equalAmounts(ids: string[], total: number): Record<string, number> {
  const base = Math.floor(total / ids.length), extra = total - base * ids.length;
  return Object.fromEntries(ids.map((id, i) => [id, base + (i < extra ? 1 : 0)]));
}

/** One amount box per person; must add up to the expense. Saves on button (table) or on every change (add form). */
function AmountEditor({ people, total, value, onChange, onSave, onReset }: {
  people: Person[]; total: number; value: Record<string, number>;
  onChange?: (v: Record<string, number>) => void; onSave?: (v: Record<string, number>) => void; onReset?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const cur = onChange ? value : draft;
  const sum = Object.values(cur).reduce((s, v) => s + v, 0);
  const diff = total - sum;
  const set = (id: string, v: number) => { const next = { ...cur, [id]: v }; if (onChange) onChange(next); else setDraft(next); };
  return (
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap gap-2">
        {people.map((p) => <label key={p.id} className="flex items-center gap-1">{p.name}<input className="input w-24" type="number" min={0} value={cur[p.id] ?? 0} onChange={(ev) => set(p.id, Math.max(0, Math.floor(Number(ev.target.value) || 0)))} /></label>)}
      </div>
      <div className={diff === 0 ? "text-emerald-700" : "text-rose-600"}>{diff === 0 ? "Đã khớp tổng" : diff > 0 ? `Còn thiếu ${vnd(diff)}` : `Dư ${vnd(-diff)}`}</div>
      {onSave && <div className="flex gap-2"><button type="button" className="btn" disabled={diff !== 0} onClick={() => onSave(Object.fromEntries(Object.entries(draft).filter(([, v]) => v > 0)))}>Lưu</button><button type="button" className="text-cyan-700 underline" onClick={onReset}>Chia đều</button></div>}
    </div>
  );
}

"use client";
import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";

export type Item = { id: string; day: number; position: number; note: string | null; destination: { id: string; name: string; city: string; lat: number; lng: number; avgCost: number } };
type Cols = Record<number, Item[]>;

const dayId = (d: number) => `day-${d}`;
const toCols = (items: Item[], days: number): Cols => {
  const c: Cols = {};
  for (let d = 1; d <= days; d++) c[d] = [];
  for (const i of [...items].sort((a, b) => a.day - b.day || a.position - b.position)) (c[i.day] ??= []).push(i);
  return c;
};

function Row({ item, onRemove, ghost }: { item: Item; onRemove?: () => void; ghost?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`flex items-center gap-2 rounded-lg border bg-white px-2 py-2 text-sm ${ghost ? "shadow-lg" : ""}`}
    >
      <button aria-label="Kéo để sắp xếp" className="cursor-grab touch-none px-1 text-slate-400" {...attributes} {...listeners}>⠿</button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.destination.name}</div>
        <div className="text-xs text-slate-500">{item.destination.city}</div>
      </div>
      {onRemove && <button className="btn-danger" onClick={onRemove}>Xoá</button>}
    </li>
  );
}

function Column({ day, items, onRemove }: { day: number; items: Item[]; onRemove: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayId(day) });
  return (
    <section className={`card ${isOver ? "ring-2 ring-brand-500" : ""}`}>
      <h3 className="mb-2 text-sm font-semibold">Ngày {day}</h3>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="min-h-[44px] space-y-2">
          {items.map((i) => <Row key={i.id} item={i} onRemove={() => onRemove(i.id)} />)}
          {items.length === 0 && <li className="rounded-lg border border-dashed py-3 text-center text-xs text-slate-400">Kéo địa điểm vào đây</li>}
        </ul>
      </SortableContext>
    </section>
  );
}

export function DayBoard({ items, days, onChange, onRemove }: { items: Item[]; days: number; onChange: (layout: { id: string; day: number; position: number }[]) => void; onRemove: (id: string) => void }) {
  const [cols, setCols] = useState<Cols>(() => toCols(items, days));
  const [active, setActive] = useState<Item | null>(null);
  useEffect(() => setCols(toCols(items, days)), [items, days]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const dayOf = (id: string): number | null => {
    if (id.startsWith("day-")) return Number(id.slice(4));
    for (const [d, list] of Object.entries(cols)) if (list.some((i) => i.id === id)) return Number(d);
    return null;
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = dayOf(String(active.id)), to = dayOf(String(over.id));
    if (from == null || to == null || from === to) return;
    setCols((c) => {
      const moving = c[from].find((i) => i.id === active.id)!;
      const overIdx = c[to].findIndex((i) => i.id === over.id);
      const at = overIdx >= 0 ? overIdx : c[to].length;
      return { ...c, [from]: c[from].filter((i) => i.id !== active.id), [to]: [...c[to].slice(0, at), moving, ...c[to].slice(at)] };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    let next = cols;
    if (over) {
      const d = dayOf(String(active.id));
      if (d != null) {
        const oldIdx = cols[d].findIndex((i) => i.id === active.id);
        const newIdx = cols[d].findIndex((i) => i.id === over.id);
        if (newIdx >= 0 && oldIdx !== newIdx) next = { ...cols, [d]: arrayMove(cols[d], oldIdx, newIdx) };
      }
    }
    setCols(next);
    onChange(Object.entries(next).flatMap(([d, list]) => list.map((i, position) => ({ id: i.id, day: Number(d), position }))));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActive(Object.values(cols).flat().find((i) => i.id === e.active.id) ?? null)} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.keys(cols).map(Number).sort((a, b) => a - b).map((d) => <Column key={d} day={d} items={cols[d]} onRemove={onRemove} />)}
      </div>
      <DragOverlay>{active && <ul><Row item={active} ghost /></ul>}</DragOverlay>
    </DndContext>
  );
}

// Database rows (snake_case) -> the camelCase JSON the UI has always received.
export type Row = Record<string, any>;

export const categoryOut = (c: Row) => ({ id: c.id, name: c.name, slug: c.slug });

export const destinationOut = (d: Row) => ({
  id: d.id, name: d.name, slug: d.slug, description: d.description, city: d.city, region: d.region, lat: d.lat, lng: d.lng,
  imageUrl: d.image_url, avgCost: d.avg_cost, rating: d.rating, categoryId: d.category_id,
  ...(d.categories ? { category: categoryOut(d.categories) } : {}),
});

export const tripOut = (t: Row) => ({
  id: t.id, title: t.title, startDate: t.start_date, endDate: t.end_date, budget: t.budget, userId: t.owner_id,
  inviteToken: t.invite_token, inviteRole: t.invite_role, createdAt: t.created_at,
});

export const itemOut = (i: Row) => ({
  id: i.id, tripId: i.trip_id, destinationId: i.destination_id, day: i.day, position: i.position, note: i.note,
  ...(i.destinations ? { destination: destinationOut(i.destinations) } : {}),
  ...(i.trip_item_votes ? { votes: i.trip_item_votes.map((v: Row) => ({ userId: v.user_id, value: v.value })) } : {}),
  ...(i.trip_item_comments ? { _count: { comments: i.trip_item_comments[0]?.count ?? 0 } } : {}),
});

export const commentOut = (c: Row) => ({ id: c.id, body: c.body, createdAt: c.created_at, userId: c.user_id, user: { name: c.profiles?.name ?? "" } });

/** Expense + its shares, flattened to `splitAmong: userId[]` (+ `shareAmounts` when the split is exact). */
export function expenseOut(e: Row) {
  const shares: { user_id: string; amount: number | null }[] = e.expense_shares ?? [];
  const exact = shares.length > 0 && shares.every((s) => s.amount !== null);
  return {
    id: e.id, tripId: e.trip_id, title: e.title, category: e.category, planned: e.planned, actual: e.actual, paidById: e.paid_by, createdAt: e.created_at,
    splitAmong: shares.map((s) => s.user_id),
    shareAmounts: exact ? Object.fromEntries(shares.map((s) => [s.user_id, s.amount as number])) : null,
  };
}

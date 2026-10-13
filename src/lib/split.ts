export type SplitExpense = { actual: number; paidById: string | null; splitAmong: string[] };
export type Transfer = { from: string; to: string; amount: number };

/**
 * Net balance per participant in VND: positive = is owed money, negative = owes money.
 * Only expenses with an actual amount and a payer count. An empty `splitAmong` means everyone.
 * Integer amounts: the remainder of an uneven split goes 1₫ each to the first sharers (sorted by id), so balances always sum to 0.
 */
export function balances(expenses: SplitExpense[], participants: string[]): Record<string, number> {
  const net: Record<string, number> = Object.fromEntries(participants.map((id) => [id, 0]));
  for (const e of expenses) {
    if (!e.paidById || e.actual <= 0) continue;
    const sharers = [...new Set(e.splitAmong.length ? e.splitAmong : participants)].sort();
    if (!sharers.length) continue;
    const base = Math.floor(e.actual / sharers.length);
    const extra = e.actual - base * sharers.length;
    sharers.forEach((id, i) => { net[id] = (net[id] ?? 0) - (base + (i < extra ? 1 : 0)); });
    net[e.paidById] = (net[e.paidById] ?? 0) + e.actual;
  }
  return net;
}

/** Fewest-ish transfers that settle all balances (greedy: biggest debtor pays biggest creditor). */
export function settle(net: Record<string, number>): Transfer[] {
  const debtors = Object.entries(net).filter(([, v]) => v < 0).map(([id, v]) => ({ id, amt: -v })).sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id));
  const creditors = Object.entries(net).filter(([, v]) => v > 0).map(([id, v]) => ({ id, amt: v })).sort((a, b) => b.amt - a.amt || a.id.localeCompare(b.id));
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amt, creditors[j].amt);
    if (amount > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].amt -= amount; creditors[j].amt -= amount;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return out;
}

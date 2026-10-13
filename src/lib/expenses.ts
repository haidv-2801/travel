import { HttpError } from "@/lib/http";

/** Prisma include + response shape for expenses: shares are flattened to `splitAmong: userId[]` (+ `shareAmounts` when the split is exact). */
export const expenseInclude = { shares: { select: { userId: true, amount: true } } } as const;

export function expenseOut<E extends { shares: { userId: string; amount: number | null }[] }>(e: E) {
  const { shares, ...rest } = e;
  const exact = shares.length > 0 && shares.every((s) => s.amount !== null);
  return {
    ...rest,
    splitAmong: shares.map((s) => s.userId),
    shareAmounts: exact ? Object.fromEntries(shares.map((s) => [s.userId, s.amount as number])) : null,
  };
}

/**
 * Rows for ExpenseShare: exact amounts when `shareAmounts` is non-empty (they must add up to the expense's actual cost),
 * otherwise equal parts for `splitAmong`.
 */
export function shareRows(splitAmong: string[] | undefined, shareAmounts: Record<string, number> | undefined, actual: number) {
  const entries = Object.entries(shareAmounts ?? {});
  if (entries.length) {
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (total !== actual) throw new HttpError(400, `Share amounts add up to ${total} but the expense is ${actual}`);
    return entries.map(([userId, amount]) => ({ userId, amount }));
  }
  return [...new Set(splitAmong ?? [])].map((userId) => ({ userId, amount: null as number | null }));
}

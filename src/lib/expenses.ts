import { HttpError } from "@/lib/http";

export const expenseSelect = "*, expense_shares(user_id, amount)";

/**
 * Rows for expense_shares: exact amounts when `shareAmounts` is non-empty (they must add up to the expense's actual cost),
 * otherwise equal parts for `splitAmong`.
 */
export function shareRows(splitAmong: string[] | undefined, shareAmounts: Record<string, number> | undefined, actual: number) {
  const entries = Object.entries(shareAmounts ?? {});
  if (entries.length) {
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (total !== actual) throw new HttpError(400, `Share amounts add up to ${total} but the expense is ${actual}`);
    return entries.map(([user_id, amount]) => ({ user_id, amount }));
  }
  return [...new Set(splitAmong ?? [])].map((user_id) => ({ user_id, amount: null as number | null }));
}

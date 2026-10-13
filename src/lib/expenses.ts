/** Prisma include + response shape for expenses: shares are flattened to `splitAmong: userId[]`. */
export const expenseInclude = { shares: { select: { userId: true } } } as const;

export function expenseOut<E extends { shares: { userId: string }[] }>(e: E) {
  const { shares, ...rest } = e;
  return { ...rest, splitAmong: shares.map((s) => s.userId) };
}

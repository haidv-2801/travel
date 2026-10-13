import { describe, expect, it } from "vitest";
import { balances, settle } from "@/lib/split";

const P = ["a", "b", "c"];
const sum = (n: Record<string, number>) => Object.values(n).reduce((s, v) => s + v, 0);

describe("balances", () => {
  it("splits equally among everyone when splitAmong is empty", () => {
    const n = balances([{ actual: 300, paidById: "a", splitAmong: [] }], P);
    expect(n).toEqual({ a: 200, b: -100, c: -100 });
  });
  it("splits only among the chosen people", () => {
    expect(balances([{ actual: 100, paidById: "a", splitAmong: ["b"] }], P)).toEqual({ a: 100, b: -100, c: 0 });
  });
  it("payer who is also a sharer only owes the rest", () => {
    expect(balances([{ actual: 200, paidById: "a", splitAmong: ["a", "b"] }], P)).toEqual({ a: 100, b: -100, c: 0 });
  });
  it("ignores expenses with no payer or no actual amount", () => {
    expect(balances([{ actual: 100, paidById: null, splitAmong: [] }, { actual: 0, paidById: "a", splitAmong: [] }], P)).toEqual({ a: 0, b: 0, c: 0 });
  });
  it("uneven splits stay in whole đồng and always sum to zero", () => {
    const n = balances([{ actual: 100, paidById: "a", splitAmong: [] }, { actual: 1_000_001, paidById: "b", splitAmong: [] }], P);
    expect(sum(n)).toBe(0);
    expect(Object.values(n).every(Number.isInteger)).toBe(true);
  });
});

describe("settle", () => {
  it("returns nothing when everyone is even", () => expect(settle({ a: 0, b: 0 })).toEqual([]));
  it("one debtor pays one creditor", () => expect(settle({ a: 100, b: -100 })).toEqual([{ from: "b", to: "a", amount: 100 }]));
  it("settles a chain with at most n-1 transfers and zeroes every balance", () => {
    const net = balances([
      { actual: 900_000, paidById: "a", splitAmong: [] },
      { actual: 300_000, paidById: "b", splitAmong: ["b", "c"] },
      { actual: 100_001, paidById: "c", splitAmong: [] },
    ], P);
    const t = settle(net);
    expect(t.length).toBeLessThanOrEqual(P.length - 1);
    const after = { ...net };
    for (const x of t) { after[x.from] += x.amount; after[x.to] -= x.amount; expect(x.amount).toBeGreaterThan(0); }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });
});

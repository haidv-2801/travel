import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const k = "k1";
    expect([1, 2, 3].map(() => rateLimit(k, 3, 1000))).toEqual([true, true, true]);
    expect(rateLimit(k, 3, 1000)).toBe(false);
  });
  it("keys are independent", () => {
    rateLimit("a", 1, 1000);
    expect(rateLimit("a", 1, 1000)).toBe(false);
    expect(rateLimit("b", 1, 1000)).toBe(true);
  });
  it("resets after the window", () => {
    vi.useFakeTimers();
    rateLimit("w", 1, 1000);
    expect(rateLimit("w", 1, 1000)).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("w", 1, 1000)).toBe(true);
  });
});

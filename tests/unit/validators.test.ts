import { describe, expect, it } from "vitest";
import { expenseSchema, itemSchema, registerSchema, reviewSchema, tripSchema } from "@/lib/validators";

describe("validators", () => {
  it("register lowercases/trims email and enforces password length", () => {
    expect(registerSchema.parse({ name: "A", email: "  A@X.com ", password: "12345678" }).email).toBe("a@x.com");
    expect(registerSchema.safeParse({ name: "A", email: "a@x.com", password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "A", email: "nope", password: "12345678" }).success).toBe(false);
  });
  it("trip requires endDate >= startDate and non-negative integer budget", () => {
    const ok = { title: "T", startDate: "2026-12-01", endDate: "2026-12-01", budget: 0 };
    expect(tripSchema.safeParse(ok).success).toBe(true);
    expect(tripSchema.safeParse({ ...ok, endDate: "2026-11-30" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...ok, budget: -1 }).success).toBe(false);
    expect(tripSchema.safeParse({ ...ok, budget: 1.5 }).success).toBe(false);
    expect(tripSchema.safeParse({ ...ok, startDate: "garbage" }).success).toBe(false);
  });
  it("item day must be a positive integer", () => {
    expect(itemSchema.safeParse({ destinationId: "x", day: 0 }).success).toBe(false);
    expect(itemSchema.safeParse({ destinationId: "x", day: 1 }).success).toBe(true);
  });
  it("expense category is restricted and amounts are non-negative", () => {
    expect(expenseSchema.safeParse({ title: "a", category: "food", planned: 1, actual: 0 }).success).toBe(true);
    expect(expenseSchema.safeParse({ title: "a", category: "weapons" }).success).toBe(false);
    expect(expenseSchema.safeParse({ title: "a", category: "food", actual: -5 }).success).toBe(false);
  });
  it("review rating 1..5 and https-only image", () => {
    expect(reviewSchema.safeParse({ rating: 5, comment: "ok" }).success).toBe(true);
    expect(reviewSchema.safeParse({ rating: 0, comment: "ok" }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: 3, comment: "ok", imageUrl: "http://a.com/x.png" }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: 3, comment: "ok", imageUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: 3, comment: "ok", imageUrl: "https://a.com/x.png" }).success).toBe(true);
  });
});

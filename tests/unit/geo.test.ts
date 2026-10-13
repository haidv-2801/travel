import { describe, expect, it } from "vitest";
import { distanceKm } from "@/lib/geo";

describe("distanceKm", () => {
  it("is zero for the same point", () => expect(distanceKm([10, 106], [10, 106])).toBe(0));
  it("Hà Nội -> TP.HCM is roughly 1,140 km", () => {
    const d = distanceKm([21.0285, 105.8542], [10.8231, 106.6297]);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1180);
  });
  it("is symmetric", () => expect(distanceKm([16, 108], [12, 109])).toBeCloseTo(distanceKm([12, 109], [16, 108]), 9));
});

import { describe, expect, it } from "vitest";
import { normalize } from "@/lib/text";

describe("normalize", () => {
  it("strips Vietnamese diacritics and đ", () => {
    expect(normalize("Đà Lạt")).toBe("da lat");
    expect(normalize("Phố cổ Hà Nội")).toBe("pho co ha noi");
    expect(normalize("Cần Thơ - Chợ nổi")).toBe("can tho - cho noi");
  });
  it("lowercases and trims", () => expect(normalize("  HỘI AN ")).toBe("hoi an"));
  it("is idempotent", () => expect(normalize(normalize("Nha Trang"))).toBe("nha trang"));
});

/** Lowercase, strip Vietnamese diacritics: "Đà Lạt" -> "da lat". */
export const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").trim();

import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { colors: { brand: { 50: "#ecfeff", 500: "#0891b2", 600: "#0e7490", 700: "#155e75" } } } },
  plugins: [],
} satisfies Config;

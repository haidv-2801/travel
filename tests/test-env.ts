import { readFileSync } from "node:fs";

/** Base URL from env or .env, forced onto an isolated "test" schema. */
export function testDatabaseUrl() {
  let base = process.env.DATABASE_URL;
  if (!base) {
    try { base = /^DATABASE_URL="?([^"\n]+)"?/m.exec(readFileSync(".env", "utf8"))?.[1]; } catch { /* no .env */ }
  }
  base ??= "postgresql://tripmate:tripmate@localhost:5432/tripmate";
  return base.replace(/[?].*$/, "") + "?schema=test";
}

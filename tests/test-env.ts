import { readFileSync } from "node:fs";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "db", "postgres"];

/** Base URL from env or .env, forced onto an isolated "test" schema. */
export function testDatabaseUrl() {
  let base = process.env.DATABASE_URL;
  if (!base) {
    try { base = /^DATABASE_URL="?([^"\n]+)"?/m.exec(readFileSync(".env", "utf8"))?.[1]; } catch { /* no .env */ }
  }
  base ??= "postgresql://tripmate:tripmate@localhost:5432/tripmate";
  // Tests TRUNCATE tables: never let a hosted database (e.g. Supabase in .env) be used by accident.
  const host = new URL(base).hostname;
  if (!LOCAL_HOSTS.includes(host) && process.env.ALLOW_REMOTE_TEST_DB !== "1")
    throw new Error(`Refusing to run tests against non-local database host "${host}". Point DATABASE_URL at a local Postgres (or set ALLOW_REMOTE_TEST_DB=1 if you really mean it).`);
  return base.replace(/[?].*$/, "") + "?schema=test";
}

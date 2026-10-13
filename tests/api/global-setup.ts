import { execSync } from "node:child_process";
import { testDatabaseUrl } from "../test-env";

export default function setup() {
  // Creates the "test" schema if needed and applies all migrations to it (never touches the dev schema).
  // DIRECT_URL must be overridden too: prisma migrate uses it, and it may point at a hosted database in .env.
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: testDatabaseUrl(), DIRECT_URL: testDatabaseUrl() } });
}

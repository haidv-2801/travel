import { defineConfig } from "vitest/config";
import path from "node:path";
import { testDatabaseUrl } from "./tests/test-env";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    env: { DATABASE_URL: testDatabaseUrl(), DIRECT_URL: testDatabaseUrl(), JWT_SECRET: "test-secret-test-secret-123456" },
    setupFiles: ["tests/api/setup.ts"],
    globalSetup: ["tests/api/global-setup.ts"],
    fileParallelism: false, // API tests share one schema
    testTimeout: 20_000,
  },
});

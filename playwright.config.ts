import { defineConfig } from "@playwright/test";

const port = 3200;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    // In sandboxes without `playwright install`, point at an existing Chromium.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  // Expects `npm run build`, a running Supabase stack (`npx supabase start`), seeded data and .env.
  webServer: { command: `npx next start -p ${port}`, url: `http://localhost:${port}`, reuseExistingServer: !process.env.CI, timeout: 60_000 },
});

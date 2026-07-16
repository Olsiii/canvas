import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "line" : "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Both dev servers are started fresh in CI; locally, reuse whatever's
  // already running (e.g. from `pnpm dev`) to keep iteration fast.
  webServer: [
    {
      command: "pnpm --filter @canvas/api dev",
      url: "http://localhost:3001/health",
      reuseExistingServer: !isCI,
      timeout: 30_000,
    },
    {
      command: "pnpm --filter @canvas/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: !isCI,
      timeout: 30_000,
    },
  ],
});

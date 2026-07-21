import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "line" : "html",
  use: {
    baseURL: "http://localhost:5183",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Both dev servers are started fresh in CI; locally, reuse whatever's
  // already running (e.g. from `pnpm dev`) to keep iteration fast.
  webServer: [
    {
      // API + BullMQ worker together — Brain chat (and image jobs) need the
      // worker process. Health-check the API; the worker shares the same
      // startup path and is up by the time /health responds.
      command:
        "sh -c 'pnpm --filter @canvas/api worker & worker_pid=$!; trap \"kill $worker_pid\" EXIT INT TERM; pnpm --filter @canvas/api dev'",
      url: "http://localhost:3001/health",
      reuseExistingServer: !isCI,
      timeout: 30_000,
      // M3.5: a fast scheduler tick so the recurring-task/reminder spec
      // doesn't wait a real day/week/month for a recurrence to become due.
      // M3.9: same idea for the digest interval — a new user's cursor
      // starts null (always due on the first tick regardless of this
      // value), but a short interval also lets the spec observe a second
      // digest cycle without waiting a real day.
      env: { SCHEDULER_TICK_MS: "3000", DIGEST_INTERVAL_MS: "3000" },
    },
    {
      command: "pnpm --filter @canvas/web dev",
      url: "http://localhost:5183",
      reuseExistingServer: !isCI,
      timeout: 30_000,
    },
  ],
});

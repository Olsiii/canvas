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
      // M5.6: points the GitHub PR-link fetch at a local mock server the
      // integrations spec starts on this fixed port (before it triggers a
      // fetch), instead of ever calling the real GitHub API — same
      // testability-seam idea as SCHEDULER_TICK_MS/DIGEST_INTERVAL_MS.
      // 2026-07-29: force Brain/Generate onto their Mock clients regardless
      // of whatever real keys a developer's own .env has configured — a
      // real OPENAI_API_KEY made every e2e run that touches Brain chat or
      // image generation a real, billed API call, which e2e must never do.
      // Only takes effect when this webServer entry actually spawns a fresh
      // process (reuseExistingServer skips it if one's already listening).
      env: {
        SCHEDULER_TICK_MS: "3000",
        DIGEST_INTERVAL_MS: "3000",
        GITHUB_API_BASE_URL: "http://127.0.0.1:4011",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        GEMINI_API_KEY: "",
      },
    },
    {
      command: "pnpm --filter @canvas/web dev",
      url: "http://localhost:5183",
      reuseExistingServer: !isCI,
      timeout: 30_000,
    },
  ],
});

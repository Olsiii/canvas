import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default("postgres://canvas:canvas@localhost:5432/canvas"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  WEB_URL: z.string().default("http://localhost:5183"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3001/auth/google/callback"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("canvas-dev"),
  S3_ACCESS_KEY_ID: z.string().default("canvas"),
  S3_SECRET_ACCESS_KEY: z.string().default("canvas12345"),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  // Unset in this environment (no key available) — the Brain chat client
  // falls back to a mock (apps/api/src/brain/), same degrade-gracefully
  // precedent as GOOGLE_CLIENT_ID/SECRET being unset. See PROGRESS.md (M2.2).
  ANTHROPIC_API_KEY: z.string().optional(),
  // Optional — image adapters stay mocked when unset (same as M2.1 Gemini).
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  // M3.5: how often the scheduler tick (recurring tasks + reminders) runs.
  // Overridden to a few seconds in apps/e2e's webServer env so the
  // recurring-tasks e2e spec doesn't wait a real day/week/month for a
  // recurrence to become due — see PROGRESS.md.
  SCHEDULER_TICK_MS: z.coerce.number().default(60_000),
  // M3.9: SMTP creds for the email digest. Unset in this environment (no
  // mail server available) — sendEmail() falls back to a mock (logs
  // instead of sending), same degrade-gracefully precedent as
  // ANTHROPIC_API_KEY/GOOGLE_CLIENT_ID being unset.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("Canvas <notifications@canvas.local>"),
  // How often a user's unread notifications are batched into a digest
  // email. Overridden to a few seconds in apps/e2e's webServer env, same
  // idea as SCHEDULER_TICK_MS.
  DIGEST_INTERVAL_MS: z.coerce.number().default(24 * 60 * 60 * 1000),
  // M5.5: overridden in apps/e2e's webServer env to point at a local mock
  // server so the ClickUp importer spec never calls the real ClickUp API,
  // same testability-seam idea as SCHEDULER_TICK_MS/DIGEST_INTERVAL_MS.
  CLICKUP_API_BASE_URL: z.string().default("https://api.clickup.com/api/v2"),
});

export const env = envSchema.parse(process.env);

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
});

export const env = envSchema.parse(process.env);

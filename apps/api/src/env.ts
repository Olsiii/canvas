import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default("postgres://canvas:canvas@localhost:5432/canvas"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  WEB_URL: z.string().default("http://localhost:5183"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3001/auth/google/callback"),
});

export const env = envSchema.parse(process.env);

import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default("postgres://canvas:canvas@localhost:5432/canvas"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
});

export const env = envSchema.parse(process.env);

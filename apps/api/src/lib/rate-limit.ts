import { redisConnection } from "../queues/connection";

// Fixed-window limiter. API keys use 60/min; auth (login/signup) uses a
// tighter per-IP (and per-email for login) budget to blunt credential stuffing.
export const RATE_LIMIT_MAX_REQUESTS = 60;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export const AUTH_RATE_LIMIT_MAX = 20;
export const AUTH_EMAIL_RATE_LIMIT_MAX = 10;

/** The window a given instant falls into, as a Redis key. */
export function rateLimitBucketKey(
  bucket: string,
  now: Date,
  windowMs = RATE_LIMIT_WINDOW_MS,
): string {
  const windowStart = Math.floor(now.getTime() / windowMs);
  return `ratelimit:${bucket}:${windowStart}`;
}

export function isOverRateLimit(
  requestCountInWindow: number,
  max = RATE_LIMIT_MAX_REQUESTS,
): boolean {
  return requestCountInWindow > max;
}

/**
 * Increments the bucket's window counter and reports whether this request
 * is over the limit. `bucket` should already be scoped (e.g. `apikey:${id}`,
 * `auth:ip:${ip}`, `auth:email:${email}`).
 */
export async function checkRateLimit(
  bucket: string,
  opts: { max?: number; windowMs?: number; now?: Date } = {},
): Promise<{ overLimit: boolean; count: number }> {
  const max = opts.max ?? RATE_LIMIT_MAX_REQUESTS;
  const windowMs = opts.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const now = opts.now ?? new Date();
  const key = rateLimitBucketKey(bucket, now, windowMs);
  const count = await redisConnection.incr(key);
  if (count === 1) {
    await redisConnection.pexpire(key, windowMs);
  }
  return { overLimit: isOverRateLimit(count, max), count };
}

export async function assertAuthRateLimit(ip: string, email?: string) {
  const { overLimit: ipOver } = await checkRateLimit(`auth:ip:${ip || "unknown"}`, {
    max: AUTH_RATE_LIMIT_MAX,
  });
  if (ipOver) {
    throw new AuthRateLimitError();
  }
  if (email) {
    const { overLimit: emailOver } = await checkRateLimit(
      `auth:email:${email.trim().toLowerCase()}`,
      { max: AUTH_EMAIL_RATE_LIMIT_MAX },
    );
    if (emailOver) {
      throw new AuthRateLimitError();
    }
  }
}

export class AuthRateLimitError extends Error {
  readonly code = "TOO_MANY_REQUESTS" as const;
  constructor() {
    super("Too many attempts. Try again in a minute.");
    this.name = "AuthRateLimitError";
  }
}

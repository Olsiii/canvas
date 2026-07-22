import { redisConnection } from "../queues/connection";

// Fixed-window limiter: 60 requests/minute per API key. Simple over a
// sliding window on purpose — a v1 REST API doesn't need anything more
// precise, and a fixed window is one INCR + one conditional EXPIRE per
// request, no Lua script.
export const RATE_LIMIT_MAX_REQUESTS = 60;
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** The window a given instant falls into, as a Redis key — same window in, same key out, so concurrent requests in the same minute share one counter. */
export function rateLimitBucketKey(apiKeyId: string, now: Date): string {
  const windowStart = Math.floor(now.getTime() / RATE_LIMIT_WINDOW_MS);
  return `ratelimit:apikey:${apiKeyId}:${windowStart}`;
}

export function isOverRateLimit(requestCountInWindow: number): boolean {
  return requestCountInWindow > RATE_LIMIT_MAX_REQUESTS;
}

/** Increments the request's window counter (creating it with a TTL on first use) and reports whether this request is over the limit. */
export async function checkRateLimit(
  apiKeyId: string,
  now: Date = new Date(),
): Promise<{ overLimit: boolean; count: number }> {
  const key = rateLimitBucketKey(apiKeyId, now);
  const count = await redisConnection.incr(key);
  if (count === 1) {
    await redisConnection.pexpire(key, RATE_LIMIT_WINDOW_MS);
  }
  return { overLimit: isOverRateLimit(count), count };
}

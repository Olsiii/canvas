import { describe, expect, it } from "vitest";
import { RATE_LIMIT_MAX_REQUESTS, isOverRateLimit, rateLimitBucketKey } from "./rate-limit";

describe("rateLimitBucketKey", () => {
  it("returns the same key for two instants in the same window", () => {
    const a = new Date("2026-07-22T12:00:00.000Z");
    const b = new Date("2026-07-22T12:00:59.999Z");
    expect(rateLimitBucketKey("key-1", a)).toBe(rateLimitBucketKey("key-1", b));
  });

  it("returns a different key once the window rolls over", () => {
    const a = new Date("2026-07-22T12:00:59.999Z");
    const b = new Date("2026-07-22T12:01:00.000Z");
    expect(rateLimitBucketKey("key-1", a)).not.toBe(rateLimitBucketKey("key-1", b));
  });

  it("scopes the key per API key id", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");
    expect(rateLimitBucketKey("key-1", now)).not.toBe(rateLimitBucketKey("key-2", now));
  });
});

describe("isOverRateLimit", () => {
  it("allows requests at or under the limit", () => {
    expect(isOverRateLimit(1)).toBe(false);
    expect(isOverRateLimit(RATE_LIMIT_MAX_REQUESTS)).toBe(false);
  });

  it("blocks requests over the limit", () => {
    expect(isOverRateLimit(RATE_LIMIT_MAX_REQUESTS + 1)).toBe(true);
  });
});

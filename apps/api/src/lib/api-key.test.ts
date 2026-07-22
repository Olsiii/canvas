import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "./api-key";

describe("generateApiKey", () => {
  it("returns a prefixed raw key and its hash", () => {
    const { raw, hash } = generateApiKey();
    expect(raw).toMatch(/^cnv_[0-9a-f]{48}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a hash matching hashApiKey(raw)", () => {
    const { raw, hash } = generateApiKey();
    expect(hashApiKey(raw)).toBe(hash);
  });

  it("never generates the same key twice", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("hashApiKey", () => {
  it("is deterministic", () => {
    expect(hashApiKey("cnv_test")).toBe(hashApiKey("cnv_test"));
  });

  it("differs for different input", () => {
    expect(hashApiKey("cnv_a")).not.toBe(hashApiKey("cnv_b"));
  });
});

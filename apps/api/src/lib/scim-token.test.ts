import { describe, expect, it } from "vitest";
import { generateScimToken, hashScimToken } from "./scim-token";

describe("generateScimToken", () => {
  it("returns a prefixed raw token and its hash", () => {
    const { raw, hash } = generateScimToken();
    expect(raw).toMatch(/^cnv_scim_[0-9a-f]{48}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a hash matching hashScimToken(raw)", () => {
    const { raw, hash } = generateScimToken();
    expect(hashScimToken(raw)).toBe(hash);
  });

  it("never generates the same token twice", () => {
    const a = generateScimToken();
    const b = generateScimToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("hashScimToken", () => {
  it("is deterministic", () => {
    expect(hashScimToken("cnv_scim_test")).toBe(hashScimToken("cnv_scim_test"));
  });

  it("differs for different input", () => {
    expect(hashScimToken("cnv_scim_a")).not.toBe(hashScimToken("cnv_scim_b"));
  });
});

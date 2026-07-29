import { describe, expect, it } from "vitest";
import { buildDmKey } from "./dm-key";

describe("buildDmKey", () => {
  it("is order-independent", () => {
    const a = "11111111-1111-7111-8111-111111111111";
    const b = "22222222-2222-7222-8222-222222222222";
    expect(buildDmKey(a, b)).toBe(buildDmKey(b, a));
  });

  it("produces a deterministic sorted-and-joined key", () => {
    const a = "11111111-1111-7111-8111-111111111111";
    const b = "22222222-2222-7222-8222-222222222222";
    expect(buildDmKey(a, b)).toBe(`${a}:${b}`);
  });

  it("throws when given a user and themself", () => {
    const a = "11111111-1111-7111-8111-111111111111";
    expect(() => buildDmKey(a, a)).toThrow(/themself/);
  });
});

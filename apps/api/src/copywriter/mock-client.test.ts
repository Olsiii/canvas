import { describe, expect, it } from "vitest";
import { MockCopyClient } from "./mock-client";
import type { GenerateCopyArgs } from "./types";

const brand = { name: "Acme", voice: "Bold", colors: null, fonts: null, notes: null };

function baseArgs(overrides: Partial<GenerateCopyArgs> = {}): GenerateCopyArgs {
  return {
    brand,
    approvedExamples: [],
    copyType: "Social caption",
    length: "medium",
    language: "sq",
    images: [{ mediaType: "image/jpeg", data: "abc" }],
    isVideoFrames: false,
    ...overrides,
  };
}

describe("MockCopyClient.generateCopy", () => {
  const client = new MockCopyClient();

  it("returns exactly 3 variants with plain text in single-output modes", async () => {
    const result = await client.generateCopy(baseArgs());
    expect(result.variants).toHaveLength(3);
    for (const v of result.variants) {
      expect(v.text).toBeTruthy();
      expect(v.design_copy).toBeUndefined();
      expect(v.caption).toBeUndefined();
    }
  });

  it("returns design_copy/caption pairs in 'Design copy + caption' mode", async () => {
    const result = await client.generateCopy(baseArgs({ copyType: "Design copy + caption" }));
    for (const v of result.variants) {
      expect(v.design_copy).toBeTruthy();
      expect(v.caption).toBeTruthy();
    }
  });

  it("mentions the frame count when isVideoFrames is set", async () => {
    const result = await client.generateCopy(
      baseArgs({
        isVideoFrames: true,
        images: [
          { mediaType: "image/jpeg", data: "a" },
          { mediaType: "image/jpeg", data: "b" },
        ],
      }),
    );
    expect(result.designRead).toContain("2-frame video");
  });

  it("reports non-zero input/output char counts", async () => {
    const result = await client.generateCopy(baseArgs());
    expect(result.inputChars).toBeGreaterThan(0);
    expect(result.outputChars).toBeGreaterThan(0);
  });
});

describe("MockCopyClient.refineCopy", () => {
  const client = new MockCopyClient();

  it("appends the instruction to the existing text", async () => {
    const result = await client.refineCopy({
      brand,
      approvedExamples: [],
      copyType: "Social caption",
      length: "medium",
      language: "sq",
      images: [],
      variant: { label: "Bold hook", text: "Original copy" },
      instruction: "make it punchier",
    });
    expect(result.variant.text).toContain("Original copy");
    expect(result.variant.text).toContain("make it punchier");
  });

  it("revises caption/design_copy independently when text is unset", async () => {
    const result = await client.refineCopy({
      brand,
      approvedExamples: [],
      copyType: "Design copy + caption",
      length: "medium",
      language: "sq",
      images: [],
      variant: { label: "Bold hook", design_copy: "Hey", caption: "There" },
      instruction: "shorter",
    });
    expect(result.variant.caption).toContain("shorter");
    expect(result.variant.design_copy).toBe("Hey");
  });
});

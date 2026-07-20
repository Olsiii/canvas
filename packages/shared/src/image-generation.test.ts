import { describe, expect, it } from "vitest";
import { STYLE_PRESETS } from "./style-presets";
import { editImageAssetSchema, generateImageAssetSchema } from "./schemas/image-assets";
import { upsertBrandSettingsSchema } from "./schemas/brand-settings";

describe("generateImageAssetSchema", () => {
  it("defaults n to 1 and size to square", () => {
    const parsed = generateImageAssetSchema.parse({
      workspaceId: "01900000-0000-7000-8000-000000000001",
      prompt: "a banner",
    });
    expect(parsed.n).toBe(1);
    expect(parsed.size).toBe("square");
    expect(parsed.useBrandPalette).toBe(false);
  });

  it("accepts n and style", () => {
    const parsed = generateImageAssetSchema.parse({
      workspaceId: "01900000-0000-7000-8000-000000000001",
      prompt: "a banner",
      n: 3,
      style: "flat",
      useBrandPalette: true,
    });
    expect(parsed.n).toBe(3);
    expect(parsed.style).toBe("flat");
  });

  it("rejects n above 4", () => {
    expect(() =>
      generateImageAssetSchema.parse({
        workspaceId: "01900000-0000-7000-8000-000000000001",
        prompt: "x",
        n: 5,
      }),
    ).toThrow();
  });
});

describe("editImageAssetSchema", () => {
  it("requires instruction and parent version", () => {
    const parsed = editImageAssetSchema.parse({
      assetId: "01900000-0000-7000-8000-000000000001",
      parentVersionId: "01900000-0000-7000-8000-000000000002",
      instruction: "make it bluer",
    });
    expect(parsed.instruction).toBe("make it bluer");
  });

  it("rejects empty instruction", () => {
    expect(() =>
      editImageAssetSchema.parse({
        assetId: "01900000-0000-7000-8000-000000000001",
        parentVersionId: "01900000-0000-7000-8000-000000000002",
        instruction: "   ",
      }),
    ).toThrow();
  });
});

describe("style presets", () => {
  it("includes the M2.4 style list", () => {
    expect(STYLE_PRESETS).toContain("photorealistic");
    expect(STYLE_PRESETS).toContain("illustration");
  });
});

describe("upsertBrandSettingsSchema", () => {
  it("accepts hex palette colors", () => {
    const parsed = upsertBrandSettingsSchema.parse({
      workspaceId: "01900000-0000-7000-8000-000000000001",
      palette: ["#112233", "#aabbcc"],
    });
    expect(parsed.palette).toHaveLength(2);
  });

  it("rejects invalid hex", () => {
    expect(() =>
      upsertBrandSettingsSchema.parse({
        workspaceId: "01900000-0000-7000-8000-000000000001",
        palette: ["red"],
      }),
    ).toThrow();
  });
});

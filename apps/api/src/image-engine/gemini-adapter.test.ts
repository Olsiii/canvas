import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { colorFromSeed, dimensionsForAspect, GeminiImageAdapter } from "./gemini-adapter";

describe("dimensionsForAspect", () => {
  it("maps each aspect preset to its pixel dimensions", () => {
    expect(dimensionsForAspect("square")).toEqual({ width: 1024, height: 1024 });
    expect(dimensionsForAspect("portrait")).toEqual({ width: 1024, height: 1536 });
    expect(dimensionsForAspect("landscape")).toEqual({ width: 1536, height: 1024 });
  });
});

describe("colorFromSeed", () => {
  it("is deterministic — the same seed always produces the same color", () => {
    expect(colorFromSeed("a prompt")).toEqual(colorFromSeed("a prompt"));
  });

  it("produces different colors for different seeds", () => {
    expect(colorFromSeed("prompt one")).not.toEqual(colorFromSeed("prompt two"));
  });

  it("always returns valid 0-255 channel values", () => {
    const { r, g, b } = colorFromSeed("some seed");
    for (const channel of [r, g, b]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
  });
});

describe("GeminiImageAdapter", () => {
  const engine = new GeminiImageAdapter();

  it("generates n images at the requested aspect's dimensions", async () => {
    const images = await engine.generate({ prompt: "a red barn", size: "landscape", n: 3 });
    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(image.width).toBe(1536);
      expect(image.height).toBe(1024);
      const meta = await sharp(image.buffer).metadata();
      expect(meta.width).toBe(1536);
      expect(meta.height).toBe(1024);
      expect(meta.format).toBe("png");
    }
  });

  it("defaults to a single image when n is omitted", async () => {
    const images = await engine.generate({ prompt: "a blue barn", size: "square" });
    expect(images).toHaveLength(1);
  });

  it("produces different images for different prompts (deterministic, not identical)", async () => {
    const [a] = await engine.generate({ prompt: "prompt A", size: "square" });
    const [b] = await engine.generate({ prompt: "prompt B", size: "square" });
    expect(a!.buffer.equals(b!.buffer)).toBe(false);
  });

  it("edit() produces one image at the requested (or default) aspect", async () => {
    const [defaultSize] = await engine.edit({
      sourceImageUrl: "https://example.com/source.png",
      instruction: "make it brighter",
    });
    expect(defaultSize).toMatchObject({ width: 1024, height: 1024 });

    const [explicitSize] = await engine.edit({
      sourceImageUrl: "https://example.com/source.png",
      instruction: "make it brighter",
      size: "portrait",
    });
    expect(explicitSize).toMatchObject({ width: 1024, height: 1536 });
  });

  it("reports its provider and model", () => {
    expect(engine.provider).toBe("gemini");
    expect(engine.model).toBe("gemini-2.5-flash-image");
  });

  it("produces a different image when reference image URLs are given", async () => {
    const [withoutRefs] = await engine.generate({ prompt: "a red barn", size: "square" });
    const [withRefs] = await engine.generate({
      prompt: "a red barn",
      size: "square",
      referenceImageUrls: ["https://example.com/ref.png"],
    });
    expect(withoutRefs!.buffer.equals(withRefs!.buffer)).toBe(false);
  });
});

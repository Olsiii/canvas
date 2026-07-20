import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_PROVIDER,
  IMAGE_PROVIDER_LABELS,
  IMAGE_PROVIDERS,
  parseImageProvider,
} from "./image-providers";

describe("image providers", () => {
  it("defaults unknown values to gemini", () => {
    expect(parseImageProvider(undefined)).toBe(DEFAULT_IMAGE_PROVIDER);
    expect(parseImageProvider("fal")).toBe("gemini");
  });

  it("accepts known providers", () => {
    for (const provider of IMAGE_PROVIDERS) {
      expect(parseImageProvider(provider)).toBe(provider);
    }
  });

  it("exposes opaque UI labels without vendor names", () => {
    for (const label of Object.values(IMAGE_PROVIDER_LABELS)) {
      expect(label.toLowerCase()).not.toMatch(/gemini|openai|gpt|anthropic/);
    }
  });
});

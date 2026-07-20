import { describe, expect, it } from "vitest";
import { mockUnderstandImage } from "./image-understanding";

describe("mockUnderstandImage", () => {
  it("builds alt text and tags from a prompt", () => {
    const result = mockUnderstandImage({ prompt: "a bold red product shot" });
    expect(result.altText).toMatch(/bold red product shot/i);
    expect(result.tags).toEqual(expect.arrayContaining(["bold", "red", "product", "shot"]));
  });

  it("falls back when empty", () => {
    const result = mockUnderstandImage({});
    expect(result.altText.length).toBeGreaterThan(0);
    expect(result.tags.length).toBeGreaterThan(0);
  });
});

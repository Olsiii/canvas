import { describe, expect, it } from "vitest";
import { mockCritiqueImage } from "./image-critique";

describe("mockCritiqueImage", () => {
  it("references the generation prompt in the critique", () => {
    const critique = mockCritiqueImage({ prompt: "a bold red product shot" });
    expect(critique).toMatch(/a bold red product shot/);
    expect(critique).toMatch(/Suggested improvements/i);
  });

  it("falls back to a generic subject when prompt and instruction are both absent", () => {
    const critique = mockCritiqueImage({});
    expect(critique).toMatch(/this image/);
  });

  it("prefers prompt over instruction when both are present", () => {
    const critique = mockCritiqueImage({
      prompt: "original prompt",
      instruction: "make it darker",
    });
    expect(critique).toMatch(/original prompt/);
  });
});

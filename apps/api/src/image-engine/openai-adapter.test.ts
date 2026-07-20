import { describe, expect, it } from "vitest";
import { getImageEngine } from "./index";
import { OpenAIImageAdapter } from "./openai-adapter";

describe("OpenAIImageAdapter", () => {
  it("reports openai / gpt-image-1", () => {
    const engine = new OpenAIImageAdapter();
    expect(engine.provider).toBe("openai");
    expect(engine.model).toBe("gpt-image-1");
  });

  it("generate() returns n images", async () => {
    const engine = new OpenAIImageAdapter();
    const images = await engine.generate({ prompt: "bottle", size: "square", n: 2 });
    expect(images).toHaveLength(2);
    expect(images[0]!.buffer.length).toBeGreaterThan(0);
  });
});

describe("getImageEngine", () => {
  it("returns the openai adapter when requested", () => {
    expect(getImageEngine("openai").provider).toBe("openai");
    expect(getImageEngine("gemini").provider).toBe("gemini");
  });
});

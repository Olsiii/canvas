import type { AspectPreset } from "@canvas/shared";
import sharp from "sharp";
import { colorFromSeed, dimensionsForAspect } from "./gemini-adapter";
import type { EditRequest, GenerateRequest, GeneratedImage, ImageEngine } from "./types";

async function placeholderImage(
  width: number,
  height: number,
  seed: string,
): Promise<GeneratedImage> {
  // Prefix the seed so OpenAI placeholders differ from Gemini's for the
  // same prompt (useful in tests asserting provider selection).
  const { r, g, b } = colorFromSeed(`openai:${seed}`);
  const buffer = await sharp({
    create: { width, height, channels: 4, background: { r, g, b, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return { buffer, width, height };
}

// gpt-image-1 adapter (ARCHITECTURE.md §3.1). Mocked like Gemini — no
// OPENAI_API_KEY in this environment. Real HTTP can replace the bodies
// later without changing ImageEngine callers.
export class OpenAIImageAdapter implements ImageEngine {
  readonly provider = "openai";
  readonly model = "gpt-image-1";

  async generate(req: GenerateRequest): Promise<GeneratedImage[]> {
    const { width, height } = dimensionsForAspect(req.size);
    const n = req.n ?? 1;
    const images: GeneratedImage[] = [];
    for (let i = 0; i < n; i++) {
      images.push(await placeholderImage(width, height, `${req.prompt}#${i}`));
    }
    return images;
  }

  async edit(req: EditRequest): Promise<GeneratedImage[]> {
    const size: AspectPreset = req.size ?? "square";
    const { width, height } = dimensionsForAspect(size);
    return [await placeholderImage(width, height, req.instruction)];
  }
}

import type { AspectPreset } from "@canvas/shared";
import sharp from "sharp";
import type { EditRequest, GenerateRequest, GeneratedImage, ImageEngine } from "./types";

const ASPECT_DIMENSIONS: Record<AspectPreset, { width: number; height: number }> = {
  square: { width: 1024, height: 1024 },
  portrait: { width: 1024, height: 1536 },
  landscape: { width: 1536, height: 1024 },
};

export function dimensionsForAspect(size: AspectPreset): { width: number; height: number } {
  return ASPECT_DIMENSIONS[size];
}

// Deterministic (same seed -> same color) so callers/tests can assert on
// output without depending on randomness or a real model.
export function colorFromSeed(seed: string): { r: number; g: number; b: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return { r: hash & 0xff, g: (hash >> 8) & 0xff, b: (hash >> 16) & 0xff };
}

async function placeholderImage(
  width: number,
  height: number,
  seed: string,
): Promise<GeneratedImage> {
  const { r, g, b } = colorFromSeed(seed);
  const buffer = await sharp({
    create: { width, height, channels: 4, background: { r, g, b, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return { buffer, width, height };
}

// The Gemini image model ("nano-banana" family, per ARCHITECTURE.md §3.1)
// isn't actually called yet — no GEMINI_API_KEY is available in this
// environment (same situation M0.2 was in for Google OAuth, see
// PROGRESS.md), and this session's build explicitly asked for the adapter
// to stay mocked while the rest of the pipeline (queue, worker, storage,
// metering) gets built and tested for real. Both methods below synthesize
// a deterministic placeholder image locally instead of making any network
// call. Swap the body of each for a real fetch() against Gemini's
// generateContent endpoint once a key exists — the ImageEngine contract and
// every caller (the worker, the tRPC router) stay unchanged either way. When
// that swap happens, req.referenceImageUrls should be attached as input
// images on the real request (Gemini's image models accept reference
// images for style/content guidance); the mock below already threads it
// into the seed so this isn't a silent no-op in the meantime.
export class GeminiImageAdapter implements ImageEngine {
  readonly provider = "gemini";
  readonly model = "gemini-2.5-flash-image";

  async generate(req: GenerateRequest): Promise<GeneratedImage[]> {
    const { width, height } = dimensionsForAspect(req.size);
    const n = req.n ?? 1;
    // Real Gemini image-to-image calls would attach these as input images;
    // folded into the seed here so the mock's output actually varies with
    // the reference set instead of silently ignoring it (matches how a real
    // call's output would differ from the same prompt with no references).
    const referenceSuffix = req.referenceImageUrls?.length
      ? `#refs:${req.referenceImageUrls.join(",")}`
      : "";
    const images: GeneratedImage[] = [];
    for (let i = 0; i < n; i++) {
      images.push(await placeholderImage(width, height, `${req.prompt}#${i}${referenceSuffix}`));
    }
    return images;
  }

  async edit(req: EditRequest): Promise<GeneratedImage[]> {
    const { width, height } = dimensionsForAspect(req.size ?? "square");
    return [await placeholderImage(width, height, req.instruction)];
  }
}

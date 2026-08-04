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

// generationConfig.imageConfig.aspectRatio — Gemini's own aspect-ratio enum,
// the closest documented equivalent to the fixed pixel pairs above.
const GEMINI_ASPECT_RATIO: Record<AspectPreset, string> = {
  square: "1:1",
  portrait: "2:3",
  landscape: "3:2",
};

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

const REQUEST_TIMEOUT_MS = 120_000;

function generateContentUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

type GenerateContentResponse = {
  candidates?: {
    content?: {
      parts?: { inlineData?: { mimeType: string; data: string } }[];
    };
  }[];
};

async function fetchAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Failed to fetch reference/source image (${res.status}): ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    data: buffer.toString("base64"),
    mimeType: res.headers.get("content-type") ?? "image/png",
  };
}

function extractImages(json: GenerateContentResponse, action: string): string[] {
  const images = (json.candidates ?? []).flatMap(
    (c) => c.content?.parts?.flatMap((p) => (p.inlineData?.data ? [p.inlineData.data] : [])) ?? [],
  );
  if (images.length === 0) throw new Error(`Gemini ${action} returned no image data`);
  return images;
}

// gemini-2.5-flash-image ("nano-banana", per ARCHITECTURE.md §3.1) via
// Google's Generative Language API `generateContent` endpoint — one
// endpoint for both generate and edit; the difference is only whether
// image parts are attached alongside the text prompt/instruction. Falls
// back to a deterministic mock when no API key is configured (same
// graceful-degradation precedent as `OpenAIImageAdapter`/Google
// OAuth/`MockChatClient`) — the key is injected by the factory
// (`getImageEngine`) from env.GEMINI_API_KEY rather than read here
// directly, keeping this class itself trivially testable.
export class GeminiImageAdapter implements ImageEngine {
  readonly provider = "gemini";
  readonly model = "gemini-2.5-flash-image";

  constructor(private readonly apiKey?: string) {}

  async generate(req: GenerateRequest): Promise<GeneratedImage[]> {
    if (!this.apiKey) return this.mockGenerate(req);

    const { width, height } = dimensionsForAspect(req.size);
    const parts: ContentPart[] = [{ text: req.prompt }];
    for (const url of req.referenceImageUrls ?? []) {
      const { data, mimeType } = await fetchAsBase64(url);
      parts.push({ inlineData: { mimeType, data } });
    }

    const b64s = await this.callGenerateContent(parts, req.size, req.n ?? 1, "generation");
    return b64s.map((b64) => ({ buffer: Buffer.from(b64, "base64"), width, height }));
  }

  async edit(req: EditRequest): Promise<GeneratedImage[]> {
    if (!this.apiKey) return this.mockEdit(req);

    const size = req.size ?? "square";
    const { width, height } = dimensionsForAspect(size);
    const source = await fetchAsBase64(req.sourceImageUrl);
    const parts: ContentPart[] = [
      { text: req.instruction },
      { inlineData: { mimeType: source.mimeType, data: source.data } },
    ];
    // Gemini's public image API has no first-class inpainting-mask
    // parameter (unlike OpenAI's edits endpoint) — attached as an extra
    // reference image rather than silently dropped, same "keep it
    // affecting real output" precedent the OpenAI adapter's
    // referenceImageUrls threading already established.
    if (req.maskUrl) {
      const mask = await fetchAsBase64(req.maskUrl);
      parts.push({ inlineData: { mimeType: mask.mimeType, data: mask.data } });
    }

    const b64s = await this.callGenerateContent(parts, size, 1, "edit");
    return b64s.map((b64) => ({ buffer: Buffer.from(b64, "base64"), width, height }));
  }

  private async callGenerateContent(
    parts: ContentPart[],
    size: AspectPreset,
    n: number,
    action: string,
  ): Promise<string[]> {
    const res = await fetch(`${generateContentUrl(this.model)}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          candidateCount: n,
          imageConfig: { aspectRatio: GEMINI_ASPECT_RATIO[size] },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini ${action} failed (${res.status}): ${text.slice(0, 500)}`);
    }
    const json = (await res.json()) as GenerateContentResponse;
    return extractImages(json, action);
  }

  private async mockGenerate(req: GenerateRequest): Promise<GeneratedImage[]> {
    const { width, height } = dimensionsForAspect(req.size);
    const n = req.n ?? 1;
    const referenceSuffix = req.referenceImageUrls?.length
      ? `#refs:${req.referenceImageUrls.join(",")}`
      : "";
    const images: GeneratedImage[] = [];
    for (let i = 0; i < n; i++) {
      images.push(await placeholderImage(width, height, `${req.prompt}#${i}${referenceSuffix}`));
    }
    return images;
  }

  private async mockEdit(req: EditRequest): Promise<GeneratedImage[]> {
    const { width, height } = dimensionsForAspect(req.size ?? "square");
    return [await placeholderImage(width, height, req.instruction)];
  }
}

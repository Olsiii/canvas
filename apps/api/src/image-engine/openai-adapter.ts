import type { AspectPreset } from "@canvas/shared";
import sharp from "sharp";
import { colorFromSeed, dimensionsForAspect } from "./gemini-adapter";
import type { EditRequest, GenerateRequest, GeneratedImage, ImageEngine } from "./types";

const GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const EDITS_URL = "https://api.openai.com/v1/images/edits";
const REQUEST_TIMEOUT_MS = 120_000;

// gpt-image-1 only accepts these three exact sizes — conveniently the same
// three dimensions this app already models as AspectPreset, so the
// dimensions returned alongside a decoded image never need to be probed
// from the image bytes themselves.
const OPENAI_SIZE: Record<AspectPreset, string> = {
  square: "1024x1024",
  portrait: "1024x1536",
  landscape: "1536x1024",
};

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

type ImagesApiResponse = { data?: { b64_json?: string }[] };

async function parseImagesResponse(res: Response, action: string): Promise<string[]> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${action} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const json = (await res.json()) as ImagesApiResponse;
  const b64s = (json.data ?? []).map((d) => d.b64_json).filter((b): b is string => !!b);
  if (b64s.length === 0) throw new Error(`OpenAI ${action} returned no image data`);
  return b64s;
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Failed to fetch reference/source image (${res.status}): ${url}`);
  return await res.blob();
}

// gpt-image-1 adapter (ARCHITECTURE.md §3.1). Falls back to a deterministic
// mock when no API key is configured (same graceful-degradation precedent
// as Google OAuth in M0.2 and Brain's MockChatClient) — the key is injected
// by the factory (`getImageEngine`) from env.OPENAI_API_KEY rather than read
// here directly, keeping this class itself trivially testable.
export class OpenAIImageAdapter implements ImageEngine {
  readonly provider = "openai";
  readonly model = "gpt-image-1";

  constructor(private readonly apiKey?: string) {}

  async generate(req: GenerateRequest): Promise<GeneratedImage[]> {
    if (!this.apiKey) return this.mockGenerate(req);

    const { width, height } = dimensionsForAspect(req.size);
    const size = OPENAI_SIZE[req.size];
    const n = req.n ?? 1;

    // gpt-image-1's text-to-image endpoint takes no image input — reference
    // images are attached by routing through the edits endpoint instead
    // (multi-image compose-as-generate), so referenceImageUrls keeps having
    // a real effect on output rather than silently doing nothing.
    if (req.referenceImageUrls?.length) {
      return this.callEdits({
        prompt: req.prompt,
        size,
        width,
        height,
        n,
        imageUrls: req.referenceImageUrls,
      });
    }

    const res = await fetch(GENERATIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.model, prompt: req.prompt, size, n }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const b64s = await parseImagesResponse(res, "generation");
    return b64s.map((b64) => ({ buffer: Buffer.from(b64, "base64"), width, height }));
  }

  async edit(req: EditRequest): Promise<GeneratedImage[]> {
    if (!this.apiKey) return this.mockEdit(req);

    const size = req.size ?? "square";
    const { width, height } = dimensionsForAspect(size);
    return this.callEdits({
      prompt: req.instruction,
      size: OPENAI_SIZE[size],
      width,
      height,
      n: 1,
      imageUrls: [req.sourceImageUrl],
      maskUrl: req.maskUrl,
    });
  }

  private async callEdits(args: {
    prompt: string;
    size: string;
    width: number;
    height: number;
    n: number;
    imageUrls: string[];
    maskUrl?: string;
  }): Promise<GeneratedImage[]> {
    const form = new FormData();
    form.set("model", this.model);
    form.set("prompt", args.prompt);
    form.set("size", args.size);
    form.set("n", String(args.n));
    for (const url of args.imageUrls) {
      form.append("image[]", await fetchAsBlob(url), "image.png");
    }
    if (args.maskUrl) {
      form.set("mask", await fetchAsBlob(args.maskUrl), "mask.png");
    }

    const res = await fetch(EDITS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const b64s = await parseImagesResponse(res, "edit");
    return b64s.map((b64) => ({
      buffer: Buffer.from(b64, "base64"),
      width: args.width,
      height: args.height,
    }));
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
    const size: AspectPreset = req.size ?? "square";
    const { width, height } = dimensionsForAspect(size);
    return [await placeholderImage(width, height, req.instruction)];
  }
}

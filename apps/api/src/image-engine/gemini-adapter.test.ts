import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
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

describe("GeminiImageAdapter (no key — mock fallback)", () => {
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

function fakeGenerateContentResponse(imageCount = 1): Response {
  const parts = Array.from({ length: imageCount }, () => ({
    inlineData: { mimeType: "image/png", data: Buffer.from("fake-png-bytes").toString("base64") },
  }));
  return new Response(JSON.stringify({ candidates: [{ content: { parts } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("GeminiImageAdapter (real API key — HTTP path)", () => {
  it("generate() calls generateContent with the prompt and candidateCount, and decodes b64 images", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeGenerateContentResponse(2));
    vi.stubGlobal("fetch", fetchMock);

    const engine = new GeminiImageAdapter("test-key");
    const images = await engine.generate({ prompt: "bottle", size: "landscape", n: 2 });

    expect(images).toHaveLength(2);
    expect(images[0]!.width).toBe(1536);
    expect(images[0]!.height).toBe(1024);
    expect(images[0]!.buffer.toString()).toBe("fake-png-bytes");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=test-key",
    );
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0]).toEqual({ text: "bottle" });
    expect(body.generationConfig).toMatchObject({
      candidateCount: 2,
      imageConfig: { aspectRatio: "3:2" },
    });

    vi.unstubAllGlobals();
  });

  it("generate() with reference images attaches them as inline image parts", async () => {
    const fetchMock = vi
      .fn()
      // one fetch per reference image (downloaded as bytes), then the generateContent call
      .mockResolvedValueOnce(new Response(new Blob(["ref-bytes"]), { status: 200 }))
      .mockResolvedValueOnce(fakeGenerateContentResponse(1));
    vi.stubGlobal("fetch", fetchMock);

    const engine = new GeminiImageAdapter("test-key");
    const images = await engine.generate({
      prompt: "bottle in this style",
      size: "square",
      referenceImageUrls: ["https://example.com/ref.png"],
    });

    expect(images).toHaveLength(1);
    const call = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.contents[0].parts).toHaveLength(2);
    expect(body.contents[0].parts[1].inlineData.data).toBe(
      Buffer.from("ref-bytes").toString("base64"),
    );

    vi.unstubAllGlobals();
  });

  it("edit() attaches the source image and an optional mask as inline image parts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Blob(["source-bytes"]), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Blob(["mask-bytes"]), { status: 200 }))
      .mockResolvedValueOnce(fakeGenerateContentResponse(1));
    vi.stubGlobal("fetch", fetchMock);

    const engine = new GeminiImageAdapter("test-key");
    const images = await engine.edit({
      sourceImageUrl: "https://example.com/source.png",
      maskUrl: "https://example.com/mask.png",
      instruction: "make the sky pink",
      size: "portrait",
    });

    expect(images).toHaveLength(1);
    expect(images[0]!.width).toBe(1024);
    expect(images[0]!.height).toBe(1536);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const call = fetchMock.mock.calls[2] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.contents[0].parts).toHaveLength(3);

    vi.unstubAllGlobals();
  });

  it("throws a clear error on a non-OK response instead of returning fake data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("resource exhausted", { status: 429, statusText: "Too Many Requests" }),
        ),
    );

    const engine = new GeminiImageAdapter("test-key");
    await expect(engine.generate({ prompt: "bottle", size: "square" })).rejects.toThrow(/429/);

    vi.unstubAllGlobals();
  });

  it("throws a clear error when the response has no image data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const engine = new GeminiImageAdapter("test-key");
    await expect(engine.generate({ prompt: "bottle", size: "square" })).rejects.toThrow(
      /no image data/,
    );

    vi.unstubAllGlobals();
  });
});

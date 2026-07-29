import { describe, expect, it, vi } from "vitest";
import { getImageEngine } from "./index";
import { OpenAIImageAdapter } from "./openai-adapter";

// No API key passed to the constructor in these — same graceful-degradation
// path as when OPENAI_API_KEY is unset in the environment (see the "real
// API key" describe block below for the HTTP-backed branch).
describe("OpenAIImageAdapter (no key — mock fallback)", () => {
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

  it("produces a different image when reference image URLs are given", async () => {
    const engine = new OpenAIImageAdapter();
    const [withoutRefs] = await engine.generate({ prompt: "bottle", size: "square" });
    const [withRefs] = await engine.generate({
      prompt: "bottle",
      size: "square",
      referenceImageUrls: ["https://example.com/ref.png"],
    });
    expect(withoutRefs!.buffer.equals(withRefs!.buffer)).toBe(false);
  });
});

function fakeImagesResponse(b64Count = 1): Response {
  const data = Array.from({ length: b64Count }, () => ({
    b64_json: Buffer.from("fake-png-bytes").toString("base64"),
  }));
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("OpenAIImageAdapter (real API key — HTTP path)", () => {
  it("generate() calls the generations endpoint with the right body and decodes b64 images", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeImagesResponse(2));
    vi.stubGlobal("fetch", fetchMock);

    const engine = new OpenAIImageAdapter("test-key");
    const images = await engine.generate({ prompt: "bottle", size: "landscape", n: 2 });

    expect(images).toHaveLength(2);
    expect(images[0]!.width).toBe(1536);
    expect(images[0]!.height).toBe(1024);
    expect(images[0]!.buffer.toString()).toBe("fake-png-bytes");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-key" });
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "gpt-image-1",
      prompt: "bottle",
      size: "1536x1024",
      n: 2,
    });

    vi.unstubAllGlobals();
  });

  it("generate() with reference images routes through the edits endpoint instead", async () => {
    const fetchMock = vi
      .fn()
      // one fetch per reference image (downloaded as a Blob), then the edits call
      .mockResolvedValueOnce(new Response(new Blob(["ref-bytes"]), { status: 200 }))
      .mockResolvedValueOnce(fakeImagesResponse(1));
    vi.stubGlobal("fetch", fetchMock);

    const engine = new OpenAIImageAdapter("test-key");
    const images = await engine.generate({
      prompt: "bottle in this style",
      size: "square",
      referenceImageUrls: ["https://example.com/ref.png"],
    });

    expect(images).toHaveLength(1);
    const editsCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(editsCall[0]).toBe("https://api.openai.com/v1/images/edits");
    expect(editsCall[1].headers).toMatchObject({ Authorization: "Bearer test-key" });

    vi.unstubAllGlobals();
  });

  it("edit() calls the edits endpoint with the source image and mask", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(new Blob(["source-bytes"]), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Blob(["mask-bytes"]), { status: 200 }))
      .mockResolvedValueOnce(fakeImagesResponse(1));
    vi.stubGlobal("fetch", fetchMock);

    const engine = new OpenAIImageAdapter("test-key");
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

    vi.unstubAllGlobals();
  });

  it("throws a clear error on a non-OK response instead of returning fake data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("insufficient_quota", { status: 429, statusText: "Too Many Requests" }),
        ),
    );

    const engine = new OpenAIImageAdapter("test-key");
    await expect(engine.generate({ prompt: "bottle", size: "square" })).rejects.toThrow(/429/);

    vi.unstubAllGlobals();
  });
});

describe("getImageEngine", () => {
  it("returns the openai adapter when requested", () => {
    expect(getImageEngine("openai").provider).toBe("openai");
    expect(getImageEngine("gemini").provider).toBe("gemini");
  });
});

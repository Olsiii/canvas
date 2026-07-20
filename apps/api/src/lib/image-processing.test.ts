import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage } from "./image-processing";

async function makeTestPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe("processImage", () => {
  it("returns a webp thumb, a blurhash, and the original dimensions for a real image", async () => {
    const buffer = await makeTestPng(800, 600);
    const result = await processImage(buffer);

    expect(result).not.toBeNull();
    expect(result!.width).toBe(800);
    expect(result!.height).toBe(600);
    expect(result!.blurhash.length).toBeGreaterThan(0);
    expect(result!.thumbContentType).toBe("image/webp");
    expect(result!.thumbBuffer.byteLength).toBeGreaterThan(0);

    const thumbMeta = await sharp(result!.thumbBuffer).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(512);
    expect(thumbMeta.height).toBeLessThanOrEqual(512);
  });

  it("returns null for a buffer that isn't a decodable image", async () => {
    const result = await processImage(Buffer.from("this is not an image"));
    expect(result).toBeNull();
  });
});

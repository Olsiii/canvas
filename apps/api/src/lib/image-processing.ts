import { encode } from "blurhash";
import sharp from "sharp";

const THUMB_MAX_SIZE = 512;
const BLURHASH_SAMPLE_SIZE = 32;

export interface ProcessedImage {
  thumbBuffer: Buffer;
  thumbContentType: string;
  blurhash: string;
  width: number;
  height: number;
}

// Pure-ish (no I/O beyond the in-memory sharp/blurhash calls) so it's
// unit-testable with a real generated image buffer. Returns null rather
// than throwing for anything sharp can't decode as an image — an upload's
// declared mimetype is client-supplied and untrustworthy, and "not
// actually a valid image" is an expected case at this boundary, not an
// exceptional one. See PROGRESS.md (M1.9 decisions).
export async function processImage(buffer: Buffer): Promise<ProcessedImage | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) return null;

    const thumbBuffer = await sharp(buffer)
      .resize(THUMB_MAX_SIZE, THUMB_MAX_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const { data, info } = await sharp(buffer)
      .resize(BLURHASH_SAMPLE_SIZE, BLURHASH_SAMPLE_SIZE, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const hash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4);

    return {
      thumbBuffer,
      thumbContentType: "image/webp",
      blurhash: hash,
      width: metadata.width,
      height: metadata.height,
    };
  } catch {
    return null;
  }
}

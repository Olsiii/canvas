import type { EmbeddingEngine } from "./types";

const DIMENSIONS = 768; // Gemini's text-embedding-004 output size.

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function hashToken(token: string, mod: number): number {
  let hash = 2166136261; // FNV-1a offset basis
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % mod;
}

// The "hashing trick" (feature hashing): each token maps to a signed bucket
// in a fixed-size vector, order-independent, no vocabulary table needed.
// A real technique (Vowpal Wabbit et al.), not a toy — texts sharing
// vocabulary land closer together under cosine similarity, texts sharing
// none don't, which is the one property a stand-in embedding needs to
// actually exercise nearest-neighbor search meaningfully.
export function localHashEmbedding(text: string, dims: number): number[] {
  const vector = new Array<number>(dims).fill(0);
  for (const token of tokenize(text)) {
    const bucket = hashToken(token, dims);
    const sign = hashToken(`${token}#sign`, 2) === 0 ? 1 : -1;
    vector[bucket] = (vector[bucket] ?? 0) + sign;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vector : vector.map((v) => v / norm);
}

// No GEMINI_API_KEY in this environment — same situation the image adapters
// and MockChatClient are already in (see PROGRESS.md M2.1/M2.2). embed()
// uses the local hashing-trick vector above instead of a network call:
// deterministic, and — unlike colorFromSeed's placeholder swatch — actually
// exhibits meaningful similarity behavior, which is what lets the rest of
// the pipeline (storage, nearest-neighbor query, search UI) be built and
// tested for real. Swap the body for a real fetch() against Gemini's
// embedContent endpoint once a key exists — the EmbeddingEngine contract
// and every caller stay unchanged either way.
export class GeminiEmbeddingAdapter implements EmbeddingEngine {
  readonly provider = "gemini";
  readonly model = "text-embedding-004";
  readonly dimensions = DIMENSIONS;

  async embed(text: string): Promise<number[]> {
    return localHashEmbedding(text, this.dimensions);
  }
}

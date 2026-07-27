import { describe, expect, it } from "vitest";
import { GeminiEmbeddingAdapter, localHashEmbedding, tokenize } from "./gemini-embedding-adapter";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot; // both vectors are already L2-normalized
}

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumeric runs", () => {
    expect(tokenize("Ship the Launch Email!")).toEqual(["ship", "the", "launch", "email"]);
  });
});

describe("localHashEmbedding", () => {
  it("is deterministic — same text produces the same vector", () => {
    const a = localHashEmbedding("Ship the launch email", 64);
    const b = localHashEmbedding("Ship the launch email", 64);
    expect(a).toEqual(b);
  });

  it("returns a vector of the requested length, L2-normalized", () => {
    const v = localHashEmbedding("some launch text", 128);
    expect(v).toHaveLength(128);
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("returns an all-zero vector for empty text", () => {
    expect(localHashEmbedding("", 32)).toEqual(new Array(32).fill(0));
  });

  it("texts sharing vocabulary are more similar than texts sharing none", () => {
    const a = localHashEmbedding("Ship the launch email to the marketing list", 256);
    const b = localHashEmbedding("Draft the launch email copy for marketing", 256);
    const c = localHashEmbedding("Fix a database migration rollback bug", 256);

    const related = cosineSimilarity(a, b);
    const unrelated = cosineSimilarity(a, c);
    expect(related).toBeGreaterThan(unrelated);
  });

  it("identical text has cosine similarity 1 with itself", () => {
    const v = localHashEmbedding("find similar tasks", 64);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });
});

describe("GeminiEmbeddingAdapter", () => {
  it("embeds text at its declared dimensionality", async () => {
    const adapter = new GeminiEmbeddingAdapter();
    const vector = await adapter.embed("a task about onboarding");
    expect(vector).toHaveLength(adapter.dimensions);
  });
});

import { GeminiEmbeddingAdapter } from "./gemini-embedding-adapter";
import type { EmbeddingEngine } from "./types";

let engine: EmbeddingEngine | null = null;

export function getEmbeddingEngine(): EmbeddingEngine {
  if (!engine) engine = new GeminiEmbeddingAdapter();
  return engine;
}

export * from "./types";

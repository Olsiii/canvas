import { GeminiImageAdapter } from "./gemini-adapter";
import type { ImageEngine } from "./types";

// Single adapter for now — no provider-selection config needed until a
// second one exists (M2.7's gpt-image-1 adapter + per-workspace config).
let engine: ImageEngine | undefined;

export function getImageEngine(): ImageEngine {
  if (!engine) engine = new GeminiImageAdapter();
  return engine;
}

export * from "./types";

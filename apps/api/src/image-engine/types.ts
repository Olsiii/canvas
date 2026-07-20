import type { AspectPreset } from "@canvas/shared";

// The real style-preset list (and the picker UI that would define it) is
// M2.4's job (Generation UX) — left as a free-form string for now rather
// than inventing values nothing reads yet.
export type StylePreset = string;

export interface GeneratedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface GenerateRequest {
  prompt: string;
  size: AspectPreset;
  style?: StylePreset;
  brandPalette?: string[];
  n?: number;
}

export interface EditRequest {
  sourceImageUrl: string;
  instruction: string;
  maskUrl?: string;
  size?: AspectPreset;
}

// Provider-agnostic image generation/editing — CLAUDE.md hard rule: "Image
// providers only via the ImageEngine interface... UI must never reference a
// provider name." Shape matches ARCHITECTURE.md §3.1 exactly.
export interface ImageEngine {
  readonly provider: string;
  readonly model: string;
  generate(req: GenerateRequest): Promise<GeneratedImage[]>;
  edit(req: EditRequest): Promise<GeneratedImage[]>;
}

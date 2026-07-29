import type { CopyLanguage, CopyLength } from "@canvas/shared";

export type CopyImage = {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
};

export type CopyVariant = {
  label: string;
  text?: string;
  design_copy?: string;
  caption?: string;
};

export type BrandVoice = {
  name: string;
  voice: string | null;
  colors: string | null;
  fonts: string | null;
  notes: string | null;
};

export type GenerateCopyArgs = {
  brand: BrandVoice;
  approvedExamples: string[];
  copyType: string;
  length: CopyLength;
  language: CopyLanguage;
  images: CopyImage[];
  isVideoFrames: boolean;
  extra?: string;
};

export type GenerateCopyResult = {
  designRead: string;
  variants: CopyVariant[];
  inputChars: number;
  outputChars: number;
};

export type RefineCopyArgs = {
  brand: BrandVoice;
  approvedExamples: string[];
  copyType: string;
  length: CopyLength;
  language: CopyLanguage;
  images: CopyImage[];
  variant: CopyVariant;
  instruction: string;
};

export type RefineCopyResult = {
  variant: CopyVariant;
  inputChars: number;
  outputChars: number;
};

// Own typed client, parallel to ImageEngine (apps/api/src/image-engine/) and
// Brain's ChatClient (apps/api/src/brain/) rather than reusing either: this
// needs a single forced tool call per request (structured copy output), not
// ImageEngine's generate/edit shape or Brain's streaming multi-tool agent
// loop. Same "swap the provider without touching callers" contract.
export interface CopyClient {
  readonly provider: string;
  readonly model: string;
  generateCopy(args: GenerateCopyArgs): Promise<GenerateCopyResult>;
  refineCopy(args: RefineCopyArgs): Promise<RefineCopyResult>;
}

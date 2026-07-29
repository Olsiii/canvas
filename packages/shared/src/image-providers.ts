export const IMAGE_PROVIDERS = ["gemini", "openai"] as const;
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

// OpenAI is the active default (2026-07-29 decision, see PROGRESS.md) — it's
// the provider with a real API key configured and a live HTTP-backed
// adapter; Gemini stays selectable (GeminiImageAdapter is untouched) in case
// a GEMINI_API_KEY is added later, it's just no longer the out-of-the-box
// choice.
export const DEFAULT_IMAGE_PROVIDER: ImageProvider = "openai";

// Product-facing labels — never expose vendor names in the UI
// (CLAUDE.md: "UI must never reference a provider name").
export const IMAGE_PROVIDER_LABELS: Record<ImageProvider, string> = {
  gemini: "Balanced edits",
  openai: "Generation quality",
};

export function parseImageProvider(value: unknown): ImageProvider {
  if (typeof value === "string" && (IMAGE_PROVIDERS as readonly string[]).includes(value)) {
    return value as ImageProvider;
  }
  return DEFAULT_IMAGE_PROVIDER;
}

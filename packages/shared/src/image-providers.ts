export const IMAGE_PROVIDERS = ["gemini", "openai"] as const;
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

export const DEFAULT_IMAGE_PROVIDER: ImageProvider = "gemini";

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

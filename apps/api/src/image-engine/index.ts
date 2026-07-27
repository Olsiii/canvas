import { parseImageProvider, type ImageProvider } from "@canvas/shared";
import { resolveEffectiveBrandKit } from "../lib/brand-kit";
import { GeminiImageAdapter } from "./gemini-adapter";
import { OpenAIImageAdapter } from "./openai-adapter";
import type { ImageEngine } from "./types";

const engines: Partial<Record<ImageProvider, ImageEngine>> = {};

export function getImageEngine(provider: ImageProvider = "gemini"): ImageEngine {
  const existing = engines[provider];
  if (existing) return existing;
  const engine = provider === "openai" ? new OpenAIImageAdapter() : new GeminiImageAdapter();
  engines[provider] = engine;
  return engine;
}

export async function getImageEngineForWorkspace({
  workspaceId,
  spaceId,
  brandKitId,
}: {
  workspaceId: string;
  spaceId?: string;
  brandKitId?: string;
}): Promise<ImageEngine> {
  const brand = await resolveEffectiveBrandKit({ workspaceId, spaceId, brandKitId });
  return getImageEngine(parseImageProvider(brand?.imageProvider));
}

export * from "./types";

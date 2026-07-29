import { DEFAULT_IMAGE_PROVIDER, parseImageProvider, type ImageProvider } from "@canvas/shared";
import { env } from "../env";
import { resolveEffectiveBrandKit } from "../lib/brand-kit";
import { GeminiImageAdapter } from "./gemini-adapter";
import { OpenAIImageAdapter } from "./openai-adapter";
import type { ImageEngine } from "./types";

const engines: Partial<Record<ImageProvider, ImageEngine>> = {};

export function getImageEngine(provider: ImageProvider = DEFAULT_IMAGE_PROVIDER): ImageEngine {
  const existing = engines[provider];
  if (existing) return existing;
  // OpenAIImageAdapter makes real gpt-image-1 calls once OPENAI_API_KEY is
  // set, else falls back to its own deterministic mock (same
  // graceful-degradation pattern as getChatClient's Anthropic/Mock split).
  // GeminiImageAdapter has no equivalent real-call path yet — no
  // GEMINI_API_KEY has been configured, so it stays fully mocked.
  const engine =
    provider === "openai" ? new OpenAIImageAdapter(env.OPENAI_API_KEY) : new GeminiImageAdapter();
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

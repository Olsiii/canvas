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
  // Both adapters make real calls once their key is set, else fall back to
  // their own deterministic mock (same graceful-degradation pattern as
  // getChatClient's Anthropic/Mock split) — the key is always injected here
  // from env, never read inside the adapter itself.
  const engine =
    provider === "openai"
      ? new OpenAIImageAdapter(env.OPENAI_API_KEY)
      : new GeminiImageAdapter(env.GEMINI_API_KEY);
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

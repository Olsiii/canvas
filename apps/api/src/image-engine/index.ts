import { parseImageProvider, type ImageProvider } from "@canvas/shared";
import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
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

export async function getImageEngineForWorkspace(workspaceId: string): Promise<ImageEngine> {
  const brand = await db.query.brandSettings.findFirst({
    where: eq(schema.brandSettings.workspaceId, workspaceId),
  });
  return getImageEngine(parseImageProvider(brand?.imageProvider));
}

export * from "./types";

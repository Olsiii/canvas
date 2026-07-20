import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import { estimateChatCostUsd } from "./ai-usage";
import { logActivity } from "./activity";

export type ImageUnderstanding = {
  altText: string;
  tags: string[];
};

// Deterministic mock understanding when no vision API is available —
// same degrade pattern as Gemini/OpenAI image adapters and MockChatClient.
export function mockUnderstandImage(context: {
  prompt?: string | null;
  instruction?: string | null;
}): ImageUnderstanding {
  const seed = (context.prompt ?? context.instruction ?? "generated image").trim();
  const tags = seed
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)
    .slice(0, 6);
  return {
    altText: `Image of ${seed}`.slice(0, 200),
    tags: tags.length > 0 ? tags : ["generated"],
  };
}

/** Write alt-text + tags on the asset and meter a vision usage row. */
export async function applyImageUnderstanding(opts: {
  workspaceId: string;
  userId: string;
  assetId: string;
  prompt?: string | null;
  instruction?: string | null;
}): Promise<ImageUnderstanding> {
  const understanding = mockUnderstandImage({
    prompt: opts.prompt,
    instruction: opts.instruction,
  });

  await db
    .update(schema.imageAssets)
    .set({
      altText: understanding.altText,
      tagsJson: understanding.tags,
      updatedAt: new Date(),
    })
    .where(eq(schema.imageAssets.id, opts.assetId));

  const seedChars = (opts.prompt ?? opts.instruction ?? "").length;
  await db.insert(schema.aiUsage).values({
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    kind: "vision",
    provider: "anthropic",
    model: "claude-vision-mock",
    credits: 1,
    costUsdEst: estimateChatCostUsd(seedChars + 200, understanding.altText.length),
  });

  await logActivity(
    opts.workspaceId,
    opts.userId,
    "image_asset",
    opts.assetId,
    "image_asset.understood",
    { tags: understanding.tags },
  );

  return understanding;
}

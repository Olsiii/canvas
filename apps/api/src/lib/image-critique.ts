import { db, schema } from "@canvas/db";
import { logActivity } from "./activity";
import { estimateChatCostUsd } from "./ai-usage";

// Deterministic mock critique when no vision API is available — same
// degrade pattern as mockUnderstandImage (image-understanding.ts).
export function mockCritiqueImage(context: {
  prompt?: string | null;
  instruction?: string | null;
}): string {
  const seed = (context.prompt ?? context.instruction ?? "this image").trim();
  return `Suggested improvements: tighten the composition around "${seed}", increase contrast between the subject and background, and simplify any competing focal points.`;
}

/** Write the critique as an ai_usage row (kind "vision") and an activity row. */
export async function critiqueImage(opts: {
  workspaceId: string;
  userId: string;
  versionId: string;
  prompt?: string | null;
  instruction?: string | null;
}): Promise<string> {
  const critique = mockCritiqueImage({ prompt: opts.prompt, instruction: opts.instruction });

  const seedChars = (opts.prompt ?? opts.instruction ?? "").length;
  await db.insert(schema.aiUsage).values({
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    kind: "vision",
    provider: "anthropic",
    model: "claude-vision-mock",
    credits: 1,
    costUsdEst: estimateChatCostUsd("anthropic", seedChars + 200, critique.length),
  });

  await logActivity(
    opts.workspaceId,
    opts.userId,
    "image_version",
    opts.versionId,
    "image_version.critiqued",
  );

  return critique;
}

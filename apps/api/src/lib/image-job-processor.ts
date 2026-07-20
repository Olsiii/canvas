import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getImageEngineForWorkspace } from "../image-engine";
import { logActivity } from "./activity";
import { estimateImageCostUsd } from "./ai-usage";
import { applyImageUnderstanding } from "./image-understanding";
import { processImage } from "./image-processing";
import { getPresignedUrl, putObject } from "./storage";
import type { ImageJobData } from "../queues/image-queue";

export type ProcessImageJobResult = {
  versionIds: string[];
  currentVersionId: string;
};

async function sourceUrlForVersion(versionId: string): Promise<string> {
  const version = await db.query.imageVersions.findFirst({
    where: eq(schema.imageVersions.id, versionId),
  });
  if (!version) throw new Error(`image_versions row ${versionId} not found`);
  return getPresignedUrl(version.fileKey);
}

// Shared by the image BullMQ worker and Brain tool executors (M2.3) so
// generate/edit have one S3+DB+metering path. Running inside either the
// image-jobs or brain-jobs worker still satisfies CLAUDE.md's "AI calls
// run in BullMQ workers" rule.
export async function processImageJob(data: ImageJobData): Promise<ProcessImageJobResult> {
  const engine = await getImageEngineForWorkspace(data.workspaceId);

  const generated =
    data.kind === "generate"
      ? await engine.generate({
          prompt: data.prompt,
          size: data.size,
          style: data.style,
          brandPalette: data.brandPalette,
          n: data.n,
        })
      : await engine.edit({
          sourceImageUrl: await sourceUrlForVersion(data.parentVersionId),
          instruction: data.instruction,
          size: data.size,
        });

  const versionIds: string[] = [];
  let lastVersionId: string | null = null;

  for (const image of generated) {
    const versionId = uuidv7();
    const fileKey = `image-assets/${data.workspaceId}/${data.assetId}/${versionId}.png`;
    await putObject(fileKey, image.buffer, "image/png");

    const processed = await processImage(image.buffer);
    let thumbKey: string | null = null;
    if (processed) {
      thumbKey = `image-assets/${data.workspaceId}/${data.assetId}/${versionId}-thumb.webp`;
      await putObject(thumbKey, processed.thumbBuffer, processed.thumbContentType);
    }

    await db.insert(schema.imageVersions).values({
      id: versionId,
      assetId: data.assetId,
      parentVersionId: data.kind === "edit" ? data.parentVersionId : null,
      source: data.kind,
      prompt: data.kind === "generate" ? data.prompt : null,
      instruction: data.kind === "edit" ? data.instruction : null,
      provider: engine.provider,
      model: engine.model,
      fileKey,
      thumbKey,
      blurhash: processed?.blurhash ?? null,
      width: image.width,
      height: image.height,
      createdBy: data.userId,
    });

    versionIds.push(versionId);
    lastVersionId = versionId;
  }

  if (!lastVersionId) throw new Error("Image job produced no versions");

  await db
    .update(schema.imageAssets)
    .set({ currentVersionId: lastVersionId, updatedAt: new Date() })
    .where(eq(schema.imageAssets.id, data.assetId));

  await db.insert(schema.aiUsage).values({
    workspaceId: data.workspaceId,
    userId: data.userId,
    kind: data.kind,
    provider: engine.provider,
    model: engine.model,
    credits: generated.length,
    costUsdEst: estimateImageCostUsd(generated.length),
  });

  await logActivity(
    data.workspaceId,
    data.userId,
    "image_asset",
    data.assetId,
    data.kind === "generate" ? "image_asset.generated" : "image_asset.edited",
  );

  await applyImageUnderstanding({
    workspaceId: data.workspaceId,
    userId: data.userId,
    assetId: data.assetId,
    prompt: data.kind === "generate" ? data.prompt : null,
    instruction: data.kind === "edit" ? data.instruction : null,
  });

  return { versionIds, currentVersionId: lastVersionId };
}

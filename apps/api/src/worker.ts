import { db, schema } from "@canvas/db";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { logActivity } from "./lib/activity";
import { estimateImageCostUsd } from "./lib/ai-usage";
import { processImage } from "./lib/image-processing";
import { ensureBucketExists, getPresignedUrl, putObject } from "./lib/storage";
import { getImageEngine } from "./image-engine";
import { IMAGE_QUEUE_NAME, redisConnection, type ImageJobData } from "./queues/image-queue";

// A separate process from the API server (`pnpm --filter @canvas/api
// worker`, wired into the root `pnpm dev` alongside it) — matches
// ARCHITECTURE.md's diagram, which draws "BullMQ workers" as its own box
// distinct from the Fastify API, and CLAUDE.md's hard rule that external AI
// calls "run in BullMQ workers — never in request handlers."
await ensureBucketExists();

const engine = getImageEngine();

async function sourceUrlForVersion(versionId: string): Promise<string> {
  const version = await db.query.imageVersions.findFirst({
    where: eq(schema.imageVersions.id, versionId),
  });
  if (!version) throw new Error(`image_versions row ${versionId} not found`);
  return getPresignedUrl(version.fileKey);
}

const worker = new Worker<ImageJobData>(
  IMAGE_QUEUE_NAME,
  async (job) => {
    const data = job.data;

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

    let lastVersionId: string | null = null;

    for (const image of generated) {
      const versionId = uuidv7();
      const fileKey = `image-assets/${data.workspaceId}/${data.assetId}/${versionId}.png`;
      await putObject(fileKey, image.buffer, "image/png");

      // Always a real, decodable image here (synthesized or provider
      // output) — processImage returning null (M1.9's "not actually an
      // image" boundary case) shouldn't happen, but the null-check stays
      // for the same reason M1.9's upload route keeps it: a real provider's
      // response isn't a guarantee either.
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

      lastVersionId = versionId;
    }

    // Multiple generated variants (n > 1) all become independent top-level
    // versions for now — the picker UX that would let a user choose one
    // (ARCHITECTURE.md's "n-variants grid") is M2.4's job, not this
    // milestone's. Whichever came out of the loop last becomes "current";
    // revisit once that picker exists.
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
  },
  { connection: redisConnection },
);

worker.on("failed", (job, err) => {
  console.error(`[worker] image job ${job?.id} failed:`, err);
});

console.log(`[worker] listening on queue "${IMAGE_QUEUE_NAME}"`);

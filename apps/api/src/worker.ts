import { db, schema } from "@canvas/db";
import { Worker } from "bullmq";
import { asc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getChatClient, type ChatMessage } from "./brain";
import { getImageEngine } from "./image-engine";
import { logActivity } from "./lib/activity";
import { estimateChatCostUsd, estimateImageCostUsd } from "./lib/ai-usage";
import { buildSystemPrompt } from "./lib/brain-system-prompt";
import { publish as publishBrainEvent } from "./lib/brain-realtime";
import { processImage } from "./lib/image-processing";
import { ensureBucketExists, getPresignedUrl, putObject } from "./lib/storage";
import { BRAIN_QUEUE_NAME, type BrainJobData } from "./queues/brain-queue";
import { redisConnection } from "./queues/connection";
import { IMAGE_QUEUE_NAME, type ImageJobData } from "./queues/image-queue";

// A separate process from the API server (`pnpm --filter @canvas/api
// worker`, wired into the root `pnpm dev` alongside it) — matches
// ARCHITECTURE.md's diagram, which draws "BullMQ workers" as its own box
// distinct from the Fastify API, and CLAUDE.md's hard rule that external AI
// calls "run in BullMQ workers — never in request handlers." Both queues
// (image-jobs, brain-jobs) are consumed by this one process for now — see
// PROGRESS.md (M2.2 decisions) — not two separate deployables yet.
await ensureBucketExists();

const engine = getImageEngine();

async function sourceUrlForVersion(versionId: string): Promise<string> {
  const version = await db.query.imageVersions.findFirst({
    where: eq(schema.imageVersions.id, versionId),
  });
  if (!version) throw new Error(`image_versions row ${versionId} not found`);
  return getPresignedUrl(version.fileKey);
}

const imageWorker = new Worker<ImageJobData>(
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

imageWorker.on("failed", (job, err) => {
  console.error(`[worker] image job ${job?.id} failed:`, err);
});

function messageText(contentJson: unknown): string {
  if (
    contentJson &&
    typeof contentJson === "object" &&
    "text" in contentJson &&
    typeof (contentJson as { text: unknown }).text === "string"
  ) {
    return (contentJson as { text: string }).text;
  }
  return "";
}

async function buildTaskSystemPrompt(taskId: string): Promise<string> {
  const task = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, taskId) });
  if (!task) return buildSystemPrompt({ type: "global" });
  const list = await db.query.lists.findFirst({ where: eq(schema.lists.id, task.listId) });
  return buildSystemPrompt({
    type: "task",
    title: task.title,
    listName: list?.name ?? "unknown list",
    descriptionJson: task.descriptionJson,
  });
}

const brainWorker = new Worker<BrainJobData>(
  BRAIN_QUEUE_NAME,
  async (job) => {
    const data = job.data;

    const conversation = await db.query.brainConversations.findFirst({
      where: eq(schema.brainConversations.id, data.conversationId),
    });
    if (!conversation) throw new Error(`brain_conversations row ${data.conversationId} not found`);

    const history = await db.query.brainMessages.findMany({
      where: eq(schema.brainMessages.conversationId, data.conversationId),
      orderBy: asc(schema.brainMessages.createdAt),
    });
    const chatMessages: ChatMessage[] = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", text: messageText(m.contentJson) }));

    const systemPrompt =
      conversation.contextType === "task" && conversation.contextId
        ? await buildTaskSystemPrompt(conversation.contextId)
        : buildSystemPrompt({ type: "global" });

    const chatClient = getChatClient();
    const inputChars =
      systemPrompt.length + chatMessages.reduce((sum, m) => sum + m.text.length, 0);
    let fullText = "";

    try {
      for await (const chunk of chatClient.streamChat(chatMessages, systemPrompt)) {
        fullText += chunk;
        await publishBrainEvent(data.conversationId, { type: "delta", text: chunk });
      }
    } catch (err) {
      console.error(`[worker] brain job for conversation ${data.conversationId} failed:`, err);
      await publishBrainEvent(data.conversationId, {
        type: "error",
        message: "Something went wrong generating a response.",
      });
      throw err;
    }

    const [assistantMessage] = await db
      .insert(schema.brainMessages)
      .values({
        conversationId: data.conversationId,
        role: "assistant",
        contentJson: { text: fullText },
      })
      .returning();
    if (!assistantMessage) throw new Error("Failed to save assistant message");

    await db.insert(schema.aiUsage).values({
      workspaceId: data.workspaceId,
      userId: data.userId,
      kind: "chat",
      provider: chatClient.provider,
      model: chatClient.model,
      credits: 1,
      costUsdEst: estimateChatCostUsd(inputChars, fullText.length),
    });

    await publishBrainEvent(data.conversationId, { type: "done", messageId: assistantMessage.id });
  },
  { connection: redisConnection },
);

brainWorker.on("failed", (job, err) => {
  console.error(`[worker] brain job ${job?.id} failed:`, err);
});

console.log(`[worker] listening on queues "${IMAGE_QUEUE_NAME}", "${BRAIN_QUEUE_NAME}"`);

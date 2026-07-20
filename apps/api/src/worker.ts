import { db, schema } from "@canvas/db";
import { Worker } from "bullmq";
import { asc, eq } from "drizzle-orm";
import { getChatClient, type ProviderMessage, type ToolCall } from "./brain";
import { executeTool } from "./brain/execute-tool";
import { BRAIN_TOOLS } from "./brain/tools";
import { estimateChatCostUsd } from "./lib/ai-usage";
import { buildSystemPrompt } from "./lib/brain-system-prompt";
import { publish as publishBrainEvent } from "./lib/brain-realtime";
import { publishImageAssetJob } from "./lib/image-asset-realtime";
import { processImageJob } from "./lib/image-job-processor";
import { ensureBucketExists } from "./lib/storage";
import { BRAIN_QUEUE_NAME, type BrainJobData } from "./queues/brain-queue";
import { redisConnection } from "./queues/connection";
import { IMAGE_QUEUE_NAME, type ImageJobData } from "./queues/image-queue";

// A separate process from the API server (`pnpm --filter @canvas/api
// worker`, wired into the root `pnpm dev` alongside it) — matches
// ARCHITECTURE.md's diagram, which draws "BullMQ workers" as its own box
// distinct from the Fastify API, and CLAUDE.md's hard rule that external AI
// calls "run in BullMQ workers — never in request handlers." Both queues
// (image-jobs, brain-jobs) are consumed by this one process for now.
await ensureBucketExists();

const MAX_AGENT_ROUNDS = 5;

const imageWorker = new Worker<ImageJobData>(
  IMAGE_QUEUE_NAME,
  async (job) => {
    const { assetId, kind } = job.data;
    await publishImageAssetJob(assetId, { status: "generating", assetId, kind });
    try {
      const result = await processImageJob(job.data);
      await publishImageAssetJob(assetId, {
        status: "done",
        assetId,
        kind,
        versionId: result.currentVersionId,
      });
    } catch (err) {
      await publishImageAssetJob(assetId, {
        status: "error",
        assetId,
        kind,
        message: err instanceof Error ? err.message : "Image job failed",
      });
      throw err;
    }
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

function toolCallsFromContent(contentJson: unknown): ToolCall[] | undefined {
  if (!contentJson || typeof contentJson !== "object") return undefined;
  const calls = (contentJson as { toolCalls?: unknown }).toolCalls;
  if (!Array.isArray(calls) || calls.length === 0) return undefined;
  return calls as ToolCall[];
}

function historyToProviderMessages(
  history: (typeof schema.brainMessages.$inferSelect)[],
): ProviderMessage[] {
  const out: ProviderMessage[] = [];
  for (const m of history) {
    if (m.role === "user") {
      out.push({ role: "user", text: messageText(m.contentJson) });
      continue;
    }
    if (m.role === "assistant") {
      const text = messageText(m.contentJson);
      const toolCalls = toolCallsFromContent(m.contentJson);
      out.push({
        role: "assistant",
        ...(text ? { text } : {}),
        ...(toolCalls ? { toolCalls } : {}),
      });
      continue;
    }
    if (m.role === "tool") {
      const c = m.contentJson as {
        toolUseId?: string;
        name?: string;
        result?: unknown;
      } | null;
      if (c?.toolUseId && c.name) {
        out.push({
          role: "tool",
          toolUseId: c.toolUseId,
          name: c.name,
          result: c.result ?? {},
        });
      }
    }
  }
  return out;
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

    const systemPrompt =
      conversation.contextType === "task" && conversation.contextId
        ? await buildTaskSystemPrompt(conversation.contextId)
        : buildSystemPrompt({ type: "global" });

    const chatClient = getChatClient();
    let lastAssistantMessageId: string | null = null;
    let totalInputChars = systemPrompt.length;
    let totalOutputChars = 0;

    try {
      for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
        const history = await db.query.brainMessages.findMany({
          where: eq(schema.brainMessages.conversationId, data.conversationId),
          orderBy: asc(schema.brainMessages.createdAt),
        });
        const providerMessages = historyToProviderMessages(history);
        totalInputChars += providerMessages.reduce((sum, m) => {
          if (m.role === "user") return sum + m.text.length;
          if (m.role === "assistant") return sum + (m.text?.length ?? 0);
          return sum + JSON.stringify(m.result).length;
        }, 0);

        let fullText = "";
        const toolCalls: ToolCall[] = [];
        let stopReason: "end_turn" | "tool_use" | "max_tokens" | "other" = "end_turn";

        for await (const chunk of chatClient.streamChat({
          messages: providerMessages,
          systemPrompt,
          tools: BRAIN_TOOLS,
        })) {
          if (chunk.type === "text") {
            fullText += chunk.text;
            await publishBrainEvent(data.conversationId, { type: "delta", text: chunk.text });
          } else if (chunk.type === "tool_use") {
            toolCalls.push({ id: chunk.id, name: chunk.name, input: chunk.input });
          } else if (chunk.type === "message_stop") {
            stopReason = chunk.stopReason;
          }
        }

        totalOutputChars += fullText.length;

        const [assistantMessage] = await db
          .insert(schema.brainMessages)
          .values({
            conversationId: data.conversationId,
            role: "assistant",
            contentJson: {
              ...(fullText ? { text: fullText } : {}),
              ...(toolCalls.length > 0 ? { toolCalls } : {}),
            },
            imageVersionIds: null,
          })
          .returning();
        if (!assistantMessage) throw new Error("Failed to save assistant message");
        lastAssistantMessageId = assistantMessage.id;

        if (stopReason !== "tool_use" || toolCalls.length === 0) {
          break;
        }

        const versionIds: string[] = [];
        for (const call of toolCalls) {
          const executed = await executeTool(call.name, call.input, {
            conversationId: data.conversationId,
            workspaceId: data.workspaceId,
            userId: data.userId,
            contextType: conversation.contextType,
            contextId: conversation.contextId,
            toolUseId: call.id,
          });

          if (executed.imageVersionIds?.length) {
            versionIds.push(...executed.imageVersionIds);
          }

          await db.insert(schema.brainMessages).values({
            conversationId: data.conversationId,
            role: "tool",
            contentJson: {
              toolUseId: call.id,
              name: executed.name,
              result: executed.result,
            },
            imageVersionIds: executed.imageVersionIds ?? null,
          });
        }

        if (versionIds.length > 0) {
          await db
            .update(schema.brainMessages)
            .set({ imageVersionIds: versionIds })
            .where(eq(schema.brainMessages.id, assistantMessage.id));
        }
      }
    } catch (err) {
      console.error(`[worker] brain job for conversation ${data.conversationId} failed:`, err);
      await publishBrainEvent(data.conversationId, {
        type: "error",
        message: "Something went wrong generating a response.",
      });
      throw err;
    }

    if (!lastAssistantMessageId) {
      throw new Error("Brain agent loop produced no assistant message");
    }

    await db.insert(schema.aiUsage).values({
      workspaceId: data.workspaceId,
      userId: data.userId,
      kind: "chat",
      provider: chatClient.provider,
      model: chatClient.model,
      credits: 1,
      costUsdEst: estimateChatCostUsd(totalInputChars, totalOutputChars),
    });

    await publishBrainEvent(data.conversationId, {
      type: "done",
      messageId: lastAssistantMessageId,
    });
  },
  { connection: redisConnection },
);

brainWorker.on("failed", (job, err) => {
  console.error(`[worker] brain job ${job?.id} failed:`, err);
});

console.log(`[worker] listening on queues "${IMAGE_QUEUE_NAME}", "${BRAIN_QUEUE_NAME}"`);

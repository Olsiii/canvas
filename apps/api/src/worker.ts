import { db, schema } from "@canvas/db";
import { Worker } from "bullmq";
import { asc, and, eq, isNull } from "drizzle-orm";
import { getChatClient, type ProviderMessage, type ToolCall } from "./brain";
import { executeTool } from "./brain/execute-tool";
import { BRAIN_TOOLS } from "./brain/tools";
import { estimateChatCostUsd } from "./lib/ai-usage";
import { buildSystemPrompt } from "./lib/brain-system-prompt";
import { publish as publishBrainEvent } from "./lib/brain-realtime";
import { publishImageAssetJob } from "./lib/image-asset-realtime";
import { processImageJob } from "./lib/image-job-processor";
import { runClickUpImport, runCsvImport } from "./lib/import-runner";
import { runSchedulerTick } from "./lib/scheduler";
import { ensureBucketExists } from "./lib/storage";
import { signWebhookPayload } from "./lib/webhook-signature";
import { BRAIN_QUEUE_NAME, type BrainJobData } from "./queues/brain-queue";
import { redisConnection } from "./queues/connection";
import { IMAGE_QUEUE_NAME, type ImageJobData } from "./queues/image-queue";
import { IMPORT_QUEUE_NAME, type ImportJobData } from "./queues/import-queue";
import { scheduleRecurringTick, SCHEDULER_QUEUE_NAME } from "./queues/scheduler-queue";
import { WEBHOOK_QUEUE_NAME, type WebhookJobData } from "./queues/webhook-queue";

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

async function buildDocSystemPrompt(docId: string): Promise<string> {
  const doc = await db.query.docs.findFirst({
    where: and(eq(schema.docs.id, docId), isNull(schema.docs.deletedAt)),
  });
  if (!doc) return buildSystemPrompt({ type: "global" });

  const linkedTasks = await db
    .select({ id: schema.tasks.id, title: schema.tasks.title })
    .from(schema.docTaskLinks)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.docTaskLinks.taskId))
    .where(and(eq(schema.docTaskLinks.docId, docId), isNull(schema.tasks.deletedAt)));

  return buildSystemPrompt({
    type: "doc",
    title: doc.title,
    linkedTasks,
  });
}

async function buildChannelSystemPrompt(channelId: string): Promise<string> {
  const channel = await db.query.channels.findFirst({
    where: and(eq(schema.channels.id, channelId), isNull(schema.channels.deletedAt)),
  });
  if (!channel) return buildSystemPrompt({ type: "global" });
  return buildSystemPrompt({ type: "channel", name: channel.name });
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
        : conversation.contextType === "doc" && conversation.contextId
          ? await buildDocSystemPrompt(conversation.contextId)
          : conversation.contextType === "channel" && conversation.contextId
            ? await buildChannelSystemPrompt(conversation.contextId)
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

// M3.5: recurring tasks + reminders. A single repeatable "tick" job rather
// than a dedicated always-on scheduler process — same BullMQ + Redis
// infra ARCHITECTURE.md already calls for, no new moving part.
await scheduleRecurringTick();

const schedulerWorker = new Worker(
  SCHEDULER_QUEUE_NAME,
  async () => {
    await runSchedulerTick();
  },
  { connection: redisConnection },
);

schedulerWorker.on("failed", (job, err) => {
  console.error(`[worker] scheduler tick ${job?.id} failed:`, err);
});

// M5.4 webhooks: signs and POSTs the payload, retried by BullMQ's own
// attempts/backoff (see webhook-queue.ts) on a non-2xx response or a
// network/timeout error — no delivery-log table exists to record attempts
// in (DATA_MODEL.md's webhooks row doesn't have one), so failures surface
// only via this worker's own logs for now.
const WEBHOOK_DELIVERY_TIMEOUT_MS = 10_000;

const webhookWorker = new Worker<WebhookJobData>(
  WEBHOOK_QUEUE_NAME,
  async (job) => {
    const { url, secret, event, payload } = job.data;
    const body = JSON.stringify(payload);
    const signature = signWebhookPayload(secret, body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Canvas-Event": event,
        "X-Canvas-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(WEBHOOK_DELIVERY_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Webhook delivery to ${url} failed with status ${response.status}`);
    }
  },
  { connection: redisConnection },
);

webhookWorker.on("failed", (job, err) => {
  console.error(`[worker] webhook delivery ${job?.id} failed:`, err);
});

// M5.5 importers: runClickUpImport/runCsvImport each own their own
// try/catch and write status="failed" + the error message onto the
// `imports` row themselves (see import-runner.ts), so a bad ClickUp token
// or malformed CSV row shows up in the import history UI rather than as a
// bare BullMQ job failure — this handler never throws, and the queue's
// own `attempts: 1` (see import-queue.ts) means a partially-applied
// import is never silently retried and duplicated.
const importWorker = new Worker<ImportJobData>(
  IMPORT_QUEUE_NAME,
  async (job) => {
    const { importId, apiToken } = job.data;
    if (apiToken) {
      await runClickUpImport(importId, apiToken);
    } else {
      await runCsvImport(importId);
    }
  },
  { connection: redisConnection },
);

importWorker.on("failed", (job, err) => {
  console.error(`[worker] import ${job?.data.importId} failed:`, err);
});

console.log(
  `[worker] listening on queues "${IMAGE_QUEUE_NAME}", "${BRAIN_QUEUE_NAME}", "${SCHEDULER_QUEUE_NAME}", "${WEBHOOK_QUEUE_NAME}", "${IMPORT_QUEUE_NAME}"`,
);

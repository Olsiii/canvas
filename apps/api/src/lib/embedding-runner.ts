import { db, schema } from "@canvas/db";
import { getEmbeddingEngine } from "../embedding-engine";
import type { EmbeddingJobData } from "../queues/embedding-queue";
import { estimateEmbedCostUsd } from "./ai-usage";

// Consumed by the embeddingWorker in worker.ts (content embeddings — the
// persisted, potentially-slow/costly path CLAUDE.md's "AI calls run in
// workers" rule protects) and, separately, called inline from search.ts for
// the query text itself (see that file for why the query side is the one
// documented exception).
export async function runEmbedding(data: EmbeddingJobData): Promise<void> {
  const engine = getEmbeddingEngine();
  const vector = await engine.embed(data.text);

  await db
    .insert(schema.embeddings)
    .values({
      workspaceId: data.workspaceId,
      entityType: data.entityType,
      entityId: data.entityId,
      model: engine.model,
      vector,
    })
    .onConflictDoUpdate({
      target: [schema.embeddings.entityType, schema.embeddings.entityId],
      set: { vector, model: engine.model, updatedAt: new Date() },
    });

  await db.insert(schema.aiUsage).values({
    workspaceId: data.workspaceId,
    userId: data.userId,
    kind: "embed",
    provider: engine.provider,
    model: engine.model,
    credits: 1,
    costUsdEst: estimateEmbedCostUsd(data.text.length),
  });
}

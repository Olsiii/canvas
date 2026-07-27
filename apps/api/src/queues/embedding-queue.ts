import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const EMBEDDING_QUEUE_NAME = "embedding-jobs";

export interface EmbeddingJobData {
  workspaceId: string;
  userId: string;
  entityType: "task" | "image_asset";
  entityId: string;
  text: string;
}

export const embeddingQueue = new Queue<EmbeddingJobData>(EMBEDDING_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

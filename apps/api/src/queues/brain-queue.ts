import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const BRAIN_QUEUE_NAME = "brain-jobs";

export interface BrainJobData {
  conversationId: string;
  workspaceId: string;
  userId: string;
}

export const brainQueue = new Queue<BrainJobData>(BRAIN_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

import type { AspectPreset } from "@canvas/shared";
import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const IMAGE_QUEUE_NAME = "image-jobs";

export type ImageJobData =
  | {
      kind: "generate";
      assetId: string;
      workspaceId: string;
      userId: string;
      prompt: string;
      size: AspectPreset;
      style?: string;
      brandPalette?: string[];
      n?: number;
    }
  | {
      kind: "edit";
      assetId: string;
      workspaceId: string;
      userId: string;
      parentVersionId: string;
      instruction: string;
      size?: AspectPreset;
    };

export const imageQueue = new Queue<ImageJobData>(IMAGE_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

import type { AspectPreset } from "@canvas/shared";
import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const IMAGE_QUEUE_NAME = "image-jobs";

export type ImageJobData =
  | {
      kind: "generate";
      assetId: string;
      workspaceId: string;
      // The space generation was triggered from, if any — used to resolve
      // which brand kit's image provider/palette applies (see brand-kit.ts).
      spaceId?: string;
      // An explicit brand kit choice, picked directly in the Generate panel —
      // takes priority over spaceId/workspace-default resolution.
      brandKitId?: string;
      userId: string;
      prompt: string;
      size: AspectPreset;
      style?: string;
      brandPalette?: string[];
      n?: number;
      /** Presigned URLs for reference images (image-to-image style). */
      referenceImageUrls?: string[];
    }
  | {
      kind: "edit";
      assetId: string;
      workspaceId: string;
      spaceId?: string;
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

import type { CopyLanguage, CopyLength } from "@canvas/shared";
import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const COPYWRITER_QUEUE_NAME = "copywriter-jobs";

export type CopywriterJobData =
  | {
      kind: "generate";
      generationId: string;
      workspaceId: string;
      brandKitId: string;
      userId: string;
      copyType: string;
      length: CopyLength;
      language: CopyLanguage;
      frameAttachmentIds: string[];
      extra?: string;
    }
  | {
      kind: "refine";
      generationId: string;
      workspaceId: string;
      brandKitId: string;
      userId: string;
      variantIndex: number;
      instruction: string;
      // Re-sent by the client from its local upload state (same frames used
      // for the original generate call) — the row only persists one
      // representative attachment (sourceAttachmentId) for the thumbnail,
      // not the full frame set.
      frameAttachmentIds: string[];
    };

export const copywriterQueue = new Queue<CopywriterJobData>(COPYWRITER_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

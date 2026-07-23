import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const IMPORT_QUEUE_NAME = "import-jobs";

// `apiToken` is only ever present for a "clickup_api" job — kept in Redis
// job data, never persisted to the `imports` Postgres row (see
// schema/imports.ts). Not retried automatically: a partially-applied
// import (some spaces/lists/tasks already created) shouldn't silently
// re-run and duplicate them on a transient failure — see PROGRESS.md.
export interface ImportJobData {
  importId: string;
  apiToken?: string;
}

export const importQueue = new Queue<ImportJobData>(IMPORT_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

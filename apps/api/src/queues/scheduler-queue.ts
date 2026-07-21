import { Queue } from "bullmq";
import { env } from "../env";
import { redisConnection } from "./connection";

export const SCHEDULER_QUEUE_NAME = "scheduler-jobs";

// A single repeatable "tick" job, not one job per due rule/reminder — the
// tick itself (apps/api/src/lib/scheduler.ts) queries what's due each time
// it runs. BullMQ dedupes a repeatable job by its name + repeat options, so
// re-adding this on every worker boot is idempotent, not cumulative.
export const schedulerQueue = new Queue(SCHEDULER_QUEUE_NAME, {
  connection: redisConnection,
});

export async function scheduleRecurringTick() {
  await schedulerQueue.add(
    "tick",
    {},
    { repeat: { every: env.SCHEDULER_TICK_MS }, removeOnComplete: 10, removeOnFail: 10 },
  );
}

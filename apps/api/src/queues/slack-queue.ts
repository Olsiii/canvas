import { Queue } from "bullmq";
import { redisConnection } from "./connection";

export const SLACK_QUEUE_NAME = "slack-jobs";

export interface SlackJobData {
  webhookUrl: string;
  text: string;
}

// Same defaultJobOptions as webhook-queue.ts — a Slack Incoming Webhook is
// just another external HTTP call, delivered off the request path for the
// same "never block on an external call" reason (see worker.ts).
export const slackQueue = new Queue<SlackJobData>(SLACK_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

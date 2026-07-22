import { z } from "zod";

// M5.4 webhooks. Reuses the same domain-event vocabulary M5.1's
// automations already trigger on (task_created/task_status_changed) —
// both are "something happened to a task" dispatchers, just to different
// destinations (in-app actions vs an external HTTP callback).
export const WEBHOOK_EVENTS = ["task.created", "task.status_changed"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const listWebhooksSchema = z.object({ workspaceId: z.string().uuid() });

export const createWebhookSchema = z.object({
  workspaceId: z.string().uuid(),
  url: z.string().trim().url().max(2000),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

export const deleteWebhookSchema = z.object({ webhookId: z.string().uuid() });

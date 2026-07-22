import { db, schema } from "@canvas/db";
import type { WebhookEvent } from "@canvas/shared";
import { eq } from "drizzle-orm";
import { webhookQueue } from "../queues/webhook-queue";

/**
 * Enqueues a delivery job (never delivers inline) for every webhook in the
 * workspace subscribed to this event — actual HTTP delivery happens in the
 * worker (worker.ts's webhookWorker), same "never block the request
 * handler on an external call" shape M2.1's image jobs already established
 * for AI calls, extended here to any external HTTP call.
 */
export async function triggerWebhooksForEvent(
  workspaceId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
) {
  const subscribed = await db.query.webhooks.findMany({
    where: eq(schema.webhooks.workspaceId, workspaceId),
  });

  for (const webhook of subscribed) {
    if (!webhook.events.includes(event)) continue;
    await webhookQueue.add("deliver", {
      webhookId: webhook.id,
      url: webhook.url,
      secret: webhook.secret,
      event,
      payload: { event, ...payload },
    });
  }
}

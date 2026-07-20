import { brainStreamEventSchema, type BrainStreamEvent } from "@canvas/shared";
import IORedis from "ioredis";
import type WebSocket from "ws";
import { env } from "../env";

// Brain stream events are published from the BullMQ worker process and
// consumed by the API process (which holds the WS sockets). An in-process
// Map alone — like lib/realtime.ts — cannot cross that boundary, so publish
// goes through Redis pub/sub and the API fans out to local sockets.
// Board invalidation stays in-process (published from API handlers only);
// only brain needs this bridge. See PROGRESS.md (M2.2 decisions).

const CHANNEL_PREFIX = "brain:";

export function brainChannel(conversationId: string) {
  return `${CHANNEL_PREFIX}${conversationId}`;
}

const subscribersByConversation = new Map<string, Set<WebSocket>>();

/** Fan-out to WS sockets held by this process only. */
export function deliverLocal(conversationId: string, event: BrainStreamEvent) {
  const sockets = subscribersByConversation.get(conversationId);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

export function subscribe(conversationId: string, socket: WebSocket) {
  let sockets = subscribersByConversation.get(conversationId);
  if (!sockets) {
    sockets = new Set();
    subscribersByConversation.set(conversationId, sockets);
  }
  sockets.add(socket);
}

export function unsubscribe(conversationId: string, socket: WebSocket) {
  const sockets = subscribersByConversation.get(conversationId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) subscribersByConversation.delete(conversationId);
}

// Dedicated publisher connection — separate from BullMQ's redisConnection
// (which requires maxRetriesPerRequest: null) and from the subscriber below
// (a connection in SUBSCRIBE mode cannot PUBLISH).
const publisher = new IORedis(env.REDIS_URL);

export async function publish(conversationId: string, event: BrainStreamEvent) {
  await publisher.publish(brainChannel(conversationId), JSON.stringify(event));
}

let subscriberStarted = false;

/** Call once from the API process at boot. Safe to call multiple times. */
export function startBrainRealtimeSubscriber() {
  if (subscriberStarted) return;
  subscriberStarted = true;

  // A connection used for psubscribe cannot be reused for other commands.
  const subscriber = new IORedis(env.REDIS_URL);
  void subscriber.psubscribe(`${CHANNEL_PREFIX}*`);

  subscriber.on("pmessage", (_pattern, channel, message) => {
    if (!channel.startsWith(CHANNEL_PREFIX)) return;
    const conversationId = channel.slice(CHANNEL_PREFIX.length);
    if (!conversationId) return;

    let json: unknown;
    try {
      json = JSON.parse(message);
    } catch {
      return;
    }
    const parsed = brainStreamEventSchema.safeParse(json);
    if (!parsed.success) return;
    deliverLocal(conversationId, parsed.data);
  });
}

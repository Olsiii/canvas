import { realtimeEventSchema, type RealtimeEvent } from "@canvas/shared";
import IORedis from "ioredis";
import type WebSocket from "ws";
import { env } from "../env";

// Board invalidation events, bridged through Redis pub/sub — same
// cross-process pattern as brain-realtime.ts/image-asset-realtime.ts.
//
// **Revised from M1.10's original call.** M1.10 kept this purely
// in-process ("every connected client is a socket held by this same Node
// process... simplest option consistent with the current deploy shape")
// because every publisher at the time was a tRPC handler running in the
// same API process as the WS sockets. M3.5's scheduler tick is the first
// publisher that runs in the *worker* process — an in-process Map there is
// invisible to the API process's sockets, so recurring-task/reminder
// invalidations silently never reached the browser. Found via the M3.5 e2e
// spec (spawn confirmed via direct DB query; UI never updated). See
// PROGRESS.md.
const CHANNEL_PREFIX = "board:";

function boardChannel(workspaceId: string) {
  return `${CHANNEL_PREFIX}${workspaceId}`;
}

const subscribersByWorkspace = new Map<string, Set<WebSocket>>();

/** Fan-out to WS sockets held by this process only. */
function deliverLocal(workspaceId: string, event: RealtimeEvent) {
  const sockets = subscribersByWorkspace.get(workspaceId);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

export function subscribe(workspaceId: string, socket: WebSocket) {
  let sockets = subscribersByWorkspace.get(workspaceId);
  if (!sockets) {
    sockets = new Set();
    subscribersByWorkspace.set(workspaceId, sockets);
  }
  sockets.add(socket);
}

export function unsubscribe(workspaceId: string, socket: WebSocket) {
  const sockets = subscribersByWorkspace.get(workspaceId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) subscribersByWorkspace.delete(workspaceId);
}

// Dedicated publisher connection — separate from BullMQ's redisConnection
// (which requires maxRetriesPerRequest: null) and from the subscriber below
// (a connection in SUBSCRIBE mode cannot PUBLISH).
const publisher = new IORedis(env.REDIS_URL);

export async function publish(workspaceId: string, event: RealtimeEvent) {
  await publisher.publish(boardChannel(workspaceId), JSON.stringify(event));
}

let subscriberStarted = false;

/** Call once from the API process at boot. Safe to call multiple times. */
export function startRealtimeSubscriber() {
  if (subscriberStarted) return;
  subscriberStarted = true;

  // A connection used for psubscribe cannot be reused for other commands.
  const subscriber = new IORedis(env.REDIS_URL);
  void subscriber.psubscribe(`${CHANNEL_PREFIX}*`);

  subscriber.on("pmessage", (_pattern, channel, message) => {
    if (!channel.startsWith(CHANNEL_PREFIX)) return;
    const workspaceId = channel.slice(CHANNEL_PREFIX.length);
    if (!workspaceId) return;

    let json: unknown;
    try {
      json = JSON.parse(message);
    } catch {
      return;
    }
    const parsed = realtimeEventSchema.safeParse(json);
    if (!parsed.success) return;
    deliverLocal(workspaceId, parsed.data);
  });
}

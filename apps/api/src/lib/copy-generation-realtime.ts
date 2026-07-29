import { copyGenerationJobEventSchema, type CopyGenerationJobEvent } from "@canvas/shared";
import IORedis from "ioredis";
import type WebSocket from "ws";
import { env } from "../env";

// Same cross-process pattern as image-asset-realtime: worker PUBLISHes, API
// PSUBSCRIBEs and fans out to WS clients watching one copy_generations row.
const CHANNEL_PREFIX = "copy-generation:";

export function copyGenerationChannel(generationId: string) {
  return `${CHANNEL_PREFIX}${generationId}`;
}

const subscribersByGeneration = new Map<string, Set<WebSocket>>();

export function deliverLocal(generationId: string, event: CopyGenerationJobEvent) {
  const sockets = subscribersByGeneration.get(generationId);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

export function subscribe(generationId: string, socket: WebSocket) {
  let sockets = subscribersByGeneration.get(generationId);
  if (!sockets) {
    sockets = new Set();
    subscribersByGeneration.set(generationId, sockets);
  }
  sockets.add(socket);
}

export function unsubscribe(generationId: string, socket: WebSocket) {
  const sockets = subscribersByGeneration.get(generationId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) subscribersByGeneration.delete(generationId);
}

const publisher = new IORedis(env.REDIS_URL);

export async function publishCopyGenerationJob(
  generationId: string,
  event: CopyGenerationJobEvent,
) {
  await publisher.publish(copyGenerationChannel(generationId), JSON.stringify(event));
}

let subscriberStarted = false;

export function startCopyGenerationRealtimeSubscriber() {
  if (subscriberStarted) return;
  subscriberStarted = true;

  const subscriber = new IORedis(env.REDIS_URL);
  void subscriber.psubscribe(`${CHANNEL_PREFIX}*`);

  subscriber.on("pmessage", (_pattern, channel, message) => {
    if (!channel.startsWith(CHANNEL_PREFIX)) return;
    const generationId = channel.slice(CHANNEL_PREFIX.length);
    if (!generationId) return;

    let json: unknown;
    try {
      json = JSON.parse(message);
    } catch {
      return;
    }
    const parsed = copyGenerationJobEventSchema.safeParse(json);
    if (!parsed.success) return;
    deliverLocal(generationId, parsed.data);
  });
}

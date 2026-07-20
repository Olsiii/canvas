import { imageAssetJobEventSchema, type ImageAssetJobEvent } from "@canvas/shared";
import IORedis from "ioredis";
import type WebSocket from "ws";
import { env } from "../env";

// Same cross-process pattern as brain-realtime: worker PUBLISHes, API
// PSUBSCRIBEs and fans out to WS clients watching an image_asset.
const CHANNEL_PREFIX = "image-asset:";

export function imageAssetChannel(assetId: string) {
  return `${CHANNEL_PREFIX}${assetId}`;
}

const subscribersByAsset = new Map<string, Set<WebSocket>>();

export function deliverLocal(assetId: string, event: ImageAssetJobEvent) {
  const sockets = subscribersByAsset.get(assetId);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

export function subscribe(assetId: string, socket: WebSocket) {
  let sockets = subscribersByAsset.get(assetId);
  if (!sockets) {
    sockets = new Set();
    subscribersByAsset.set(assetId, sockets);
  }
  sockets.add(socket);
}

export function unsubscribe(assetId: string, socket: WebSocket) {
  const sockets = subscribersByAsset.get(assetId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) subscribersByAsset.delete(assetId);
}

const publisher = new IORedis(env.REDIS_URL);

export async function publishImageAssetJob(assetId: string, event: ImageAssetJobEvent) {
  await publisher.publish(imageAssetChannel(assetId), JSON.stringify(event));
}

let subscriberStarted = false;

export function startImageAssetRealtimeSubscriber() {
  if (subscriberStarted) return;
  subscriberStarted = true;

  const subscriber = new IORedis(env.REDIS_URL);
  void subscriber.psubscribe(`${CHANNEL_PREFIX}*`);

  subscriber.on("pmessage", (_pattern, channel, message) => {
    if (!channel.startsWith(CHANNEL_PREFIX)) return;
    const assetId = channel.slice(CHANNEL_PREFIX.length);
    if (!assetId) return;

    let json: unknown;
    try {
      json = JSON.parse(message);
    } catch {
      return;
    }
    const parsed = imageAssetJobEventSchema.safeParse(json);
    if (!parsed.success) return;
    deliverLocal(assetId, parsed.data);
  });
}

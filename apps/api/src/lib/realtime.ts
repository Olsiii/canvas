import type { RealtimeEvent } from "@canvas/shared";
import type WebSocket from "ws";

// In-process pub/sub: every connected client is a socket held by this same
// Node process. ARCHITECTURE.md's Realtime row lists only "WebSocket
// (fastify-websocket)" with no Redis, unlike the Jobs row — so this is the
// simplest option consistent with the current (single-instance) deploy
// shape, not a corner cut. Revisit with Redis pub/sub if the API is ever
// horizontally scaled. See PROGRESS.md (M1.10 decisions).
const subscribersByWorkspace = new Map<string, Set<WebSocket>>();

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

export function publish(workspaceId: string, event: RealtimeEvent) {
  const sockets = subscribersByWorkspace.get(workspaceId);
  if (!sockets || sockets.size === 0) return;
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

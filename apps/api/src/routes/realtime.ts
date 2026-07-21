import type { FastifyInstance } from "fastify";
import { can } from "../auth/can";
import { getSessionUser } from "../auth/session";
import { getMembershipRole } from "../lib/membership";
import { startRealtimeSubscriber, subscribe, unsubscribe } from "../lib/realtime";

// One WS connection per open workspace tab, scoped by a `workspaceId` query
// param (simplest option — no subscribe/unsubscribe message protocol needed
// since a client only ever cares about the one workspace it's viewing).
// Server -> client only: invalidation events, no client -> server messages.
// See ARCHITECTURE.md's realtime protocol and PROGRESS.md (M1.10, M3.5).
export function registerRealtimeRoutes(app: FastifyInstance) {
  // Subscribe to Redis so worker-published events (e.g. M3.5's scheduler
  // tick) reach the WS sockets held by this API process, not just events
  // published by this process's own tRPC handlers.
  startRealtimeSubscriber();

  app.get<{ Querystring: { workspaceId?: string } }>(
    "/ws",
    { websocket: true },
    async (socket, req) => {
      const user = await getSessionUser(req);
      const workspaceId = req.query.workspaceId;

      if (!user || !workspaceId) {
        socket.close(4001, "Unauthorized");
        return;
      }

      const role = await getMembershipRole(workspaceId, user.id);
      if (!can(user, "task:view", { type: "workspace", role })) {
        socket.close(4001, "Unauthorized");
        return;
      }

      subscribe(workspaceId, socket);
      socket.on("close", () => unsubscribe(workspaceId, socket));
    },
  );
}

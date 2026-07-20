import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { getSessionUser } from "../auth/session";
import { startBrainRealtimeSubscriber, subscribe, unsubscribe } from "../lib/brain-realtime";

// One WS connection per open Brain chat panel, scoped by conversationId.
// Conversations are per-user (see PROGRESS.md M2.2 decisions), so the only
// authorization check needed is "does this conversation belong to the
// connecting user" — no separate workspace-membership check, since owning
// the conversation already implies that.
export function registerBrainRealtimeRoutes(app: FastifyInstance) {
  // Subscribe to Redis so worker-published deltas reach the WS sockets
  // held by this API process. Must run in the API process only — the
  // worker publishes but does not hold client sockets.
  startBrainRealtimeSubscriber();

  app.get<{ Querystring: { conversationId?: string } }>(
    "/ws/brain",
    { websocket: true },
    async (socket, req) => {
      const user = await getSessionUser(req);
      const conversationId = req.query.conversationId;

      if (!user || !conversationId) {
        socket.close(4001, "Unauthorized");
        return;
      }

      const conversation = await db.query.brainConversations.findFirst({
        where: eq(schema.brainConversations.id, conversationId),
      });

      if (!conversation || conversation.createdBy !== user.id) {
        socket.close(4001, "Unauthorized");
        return;
      }

      subscribe(conversationId, socket);
      socket.on("close", () => unsubscribe(conversationId, socket));
    },
  );
}

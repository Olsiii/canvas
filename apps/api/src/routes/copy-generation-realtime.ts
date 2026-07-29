import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { can } from "../auth/can";
import { getSessionUser } from "../auth/session";
import {
  startCopyGenerationRealtimeSubscriber,
  subscribe,
  unsubscribe,
} from "../lib/copy-generation-realtime";
import { getMembershipRole } from "../lib/membership";

export function registerCopyGenerationRealtimeRoutes(app: FastifyInstance) {
  startCopyGenerationRealtimeSubscriber();

  app.get<{ Querystring: { generationId?: string } }>(
    "/ws/copy-generation",
    { websocket: true },
    async (socket, req) => {
      const user = await getSessionUser(req);
      const generationId = req.query.generationId;

      if (!user || !generationId) {
        socket.close(4001, "Unauthorized");
        return;
      }

      const generation = await db.query.copyGenerations.findFirst({
        where: eq(schema.copyGenerations.id, generationId),
      });
      if (!generation) {
        socket.close(4001, "Unauthorized");
        return;
      }

      const role = await getMembershipRole(generation.workspaceId, user.id);
      if (!can(user, "copyGeneration:create", { type: "workspace", role })) {
        socket.close(4001, "Unauthorized");
        return;
      }

      subscribe(generationId, socket);
      socket.on("close", () => unsubscribe(generationId, socket));
    },
  );
}

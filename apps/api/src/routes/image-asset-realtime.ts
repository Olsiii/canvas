import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { can } from "../auth/can";
import { getSessionUser } from "../auth/session";
import {
  startImageAssetRealtimeSubscriber,
  subscribe,
  unsubscribe,
} from "../lib/image-asset-realtime";
import { getMembershipRole } from "../lib/membership";

export function registerImageAssetRealtimeRoutes(app: FastifyInstance) {
  startImageAssetRealtimeSubscriber();

  app.get<{ Querystring: { assetId?: string } }>(
    "/ws/image-asset",
    { websocket: true },
    async (socket, req) => {
      const user = await getSessionUser(req);
      const assetId = req.query.assetId;

      if (!user || !assetId) {
        socket.close(4001, "Unauthorized");
        return;
      }

      const asset = await db.query.imageAssets.findFirst({
        where: eq(schema.imageAssets.id, assetId),
      });
      if (!asset) {
        socket.close(4001, "Unauthorized");
        return;
      }

      const role = await getMembershipRole(asset.workspaceId, user.id);
      if (!can(user, "imageAsset:view", { type: "workspace", role })) {
        socket.close(4001, "Unauthorized");
        return;
      }

      subscribe(assetId, socket);
      socket.on("close", () => unsubscribe(assetId, socket));
    },
  );
}

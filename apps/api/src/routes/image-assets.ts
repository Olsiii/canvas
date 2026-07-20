import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Readable } from "node:stream";
import { can } from "../auth/can";
import { getSessionUser } from "../auth/session";
import { getMembershipRole } from "../lib/membership";
import { getObject } from "../lib/storage";

// Browser never talks to MinIO directly — same pattern as /uploads for
// attachments. Serves Brain image_versions for the Generation UX grid.
export function registerImageAssetRoutes(app: FastifyInstance) {
  app.get<{ Params: { versionId: string } }>("/image-versions/:versionId", (req, reply) =>
    streamVersion(req, reply, "file"),
  );

  app.get<{ Params: { versionId: string } }>("/image-versions/:versionId/thumb", (req, reply) =>
    streamVersion(req, reply, "thumb"),
  );
}

async function streamVersion(
  req: FastifyRequest<{ Params: { versionId: string } }>,
  reply: FastifyReply,
  kind: "file" | "thumb",
) {
  const user = await getSessionUser(req);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });

  const version = await db.query.imageVersions.findFirst({
    where: eq(schema.imageVersions.id, req.params.versionId),
  });
  if (!version) return reply.code(404).send({ error: "Not found" });

  const asset = await db.query.imageAssets.findFirst({
    where: eq(schema.imageAssets.id, version.assetId),
  });
  if (!asset) return reply.code(404).send({ error: "Not found" });

  const role = await getMembershipRole(asset.workspaceId, user.id);
  if (!can(user, "imageAsset:view", { type: "workspace", role })) {
    return reply.code(403).send({ error: "Forbidden" });
  }

  const key = kind === "thumb" ? version.thumbKey : version.fileKey;
  if (!key) return reply.code(404).send({ error: "Not found" });

  const object = await getObject(key);
  reply.header(
    "Content-Type",
    object.ContentType ?? (kind === "thumb" ? "image/webp" : "image/png"),
  );
  reply.header("Cache-Control", "private, max-age=3600");
  return reply.send(object.Body as Readable);
}

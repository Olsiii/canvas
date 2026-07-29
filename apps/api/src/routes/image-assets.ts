import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Readable } from "node:stream";
import { uuidv7 } from "uuidv7";
import { can } from "../auth/can";
import { getSessionUser } from "../auth/session";
import { logActivity } from "../lib/activity";
import { sanitizeFilenameForKey, sanitizeForHeader } from "../lib/filename";
import { processImage } from "../lib/image-processing";
import { isInlineSafeMimeType, safeContentType } from "../lib/mime-safety";
import { getMembershipRole } from "../lib/membership";
import { getObject, putObject } from "../lib/storage";

// Browser never talks to MinIO directly — same pattern as /uploads for
// attachments. Serves Brain image_versions for the Generation UX grid.
export function registerImageAssetRoutes(app: FastifyInstance) {
  // Direct upload into the Library, independent of any task — same plain
  // multipart REST route reasoning as attachments.ts's /uploads (tRPC has
  // no native file transport). Unlike a generated image, there's no AI
  // provider involved, so the resulting image_versions row is written
  // synchronously here rather than via a BullMQ job.
  app.post("/image-assets/upload", async (req, reply) => {
    const user = await getSessionUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    let workspaceId: string | undefined;
    let folderId: string | undefined;
    let file: { buffer: Buffer; filename: string; mimetype: string } | undefined;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        file = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype };
      } else if (part.fieldname === "workspaceId" && typeof part.value === "string") {
        workspaceId = part.value;
      } else if (part.fieldname === "folderId" && typeof part.value === "string" && part.value) {
        folderId = part.value;
      }
    }

    if (!workspaceId || !file) {
      return reply.code(400).send({ error: "Missing file or workspaceId" });
    }
    // svg starts with "image/" but can embed <script> and execute it when
    // its direct URL is opened as a top-level document — no legitimate use
    // case here (this library is photos/renders, not vector graphics), so
    // it's rejected outright rather than merely downgraded at serve time.
    if (!file.mimetype.startsWith("image/") || file.mimetype.toLowerCase() === "image/svg+xml") {
      return reply.code(400).send({ error: "File must be an image" });
    }

    const role = await getMembershipRole(workspaceId, user.id);
    if (!can(user, "imageAsset:create", { type: "workspace", role })) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    if (folderId) {
      const folder = await db.query.imageFolders.findFirst({
        where: eq(schema.imageFolders.id, folderId),
      });
      if (!folder || folder.workspaceId !== workspaceId || folder.deletedAt) {
        return reply.code(400).send({ error: "Folder not found" });
      }
    }

    const processed = await processImage(file.buffer);
    if (!processed) {
      return reply.code(400).send({ error: "Could not read this file as an image" });
    }

    // Generated up front, same reasoning as attachments.ts's attachmentId:
    // the S3 keys are namespaced by asset id and must be known before insert.
    const assetId = uuidv7();
    const versionId = uuidv7();
    const originalKey = `image-assets/${workspaceId}/${assetId}/${sanitizeFilenameForKey(file.filename)}`;
    const thumbKey = `image-assets/${workspaceId}/${assetId}/thumb.webp`;
    await putObject(originalKey, file.buffer, file.mimetype);
    await putObject(thumbKey, processed.thumbBuffer, processed.thumbContentType);

    // A reasonable default label without spending a vision call on it —
    // uploads (unlike generations/edits) never go through
    // applyImageUnderstanding, so there's no AI-written alt text to wait on.
    const altText =
      file.filename
        .replace(/\.[^./]+$/, "")
        .trim()
        .slice(0, 200) || null;

    // Same two-step insert-then-promote order as the generate job processor
    // (image-job-processor.ts): image_versions.asset_id FK requires the
    // asset row to exist first, so current_version_id starts null and is
    // set once the version row is in.
    await db.insert(schema.imageAssets).values({
      id: assetId,
      workspaceId,
      createdBy: user.id,
      origin: "upload",
      folderId: folderId ?? null,
      altText,
    });
    await db.insert(schema.imageVersions).values({
      id: versionId,
      assetId,
      source: "upload",
      provider: "upload",
      model: "n/a",
      fileKey: originalKey,
      thumbKey,
      blurhash: processed.blurhash,
      width: processed.width,
      height: processed.height,
      createdBy: user.id,
    });
    await db
      .update(schema.imageAssets)
      .set({ currentVersionId: versionId, updatedAt: new Date() })
      .where(eq(schema.imageAssets.id, assetId));

    await logActivity(workspaceId, user.id, "image_asset", assetId, "image_asset.uploaded");

    return reply.send({ id: assetId, currentVersionId: versionId });
  });

  app.get<{ Params: { versionId: string }; Querystring: { download?: string } }>(
    "/image-versions/:versionId",
    (req, reply) => streamVersion(req, reply, "file"),
  );

  app.get<{ Params: { versionId: string } }>("/image-versions/:versionId/thumb", (req, reply) =>
    streamVersion(req, reply, "thumb"),
  );
}

async function streamVersion(
  req: FastifyRequest<{ Params: { versionId: string }; Querystring?: { download?: string } }>,
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
  const rawContentType = object.ContentType ?? (kind === "thumb" ? "image/webp" : "image/png");
  // Thumbnails and AI-generated originals are always server-produced
  // (processImage / the image engine adapters, always PNG) — only an
  // uploaded original's mime is user-controlled and needs downgrading if
  // it isn't actually a safe-to-render-inline type (see mime-safety.ts).
  const inlineSafe = kind === "thumb" || isInlineSafeMimeType(rawContentType);
  reply.header("Content-Type", inlineSafe ? rawContentType : safeContentType(rawContentType));
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Cache-Control", "private, max-age=3600");
  // "Save to your PC" from the Library detail panel — this is the library
  // for everyone, so anyone who can view the asset can pull a local copy,
  // same guard tier as the inline view above (imageAsset:view).
  if (kind === "file" && (req.query?.download || !inlineSafe)) {
    const fileName = key.split("/").pop() ?? `${asset.id}.png`;
    reply.header("Content-Disposition", `attachment; filename="${sanitizeForHeader(fileName)}"`);
  }
  return reply.send(object.Body as Readable);
}

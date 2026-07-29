import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { uuidv7 } from "uuidv7";
import { can } from "../auth/can";
import { getSessionUser } from "../auth/session";
import { logActivity } from "../lib/activity";
import { sanitizeFilenameForKey } from "../lib/filename";
import { processImage } from "../lib/image-processing";
import { getMembershipRole } from "../lib/membership";
import { putObject } from "../lib/storage";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB — videos + PDFs for AI reference

/**
 * Workspace-scoped AI reference uploads (Generate / Brain). Unlike /uploads,
 * these are not tied to a task or chat message — they live as attachments
 * with only workspaceId set, and images also get an image_assets row so
 * Generate/Brain can use image_version ids.
 */
export function registerAiReferenceRoutes(app: FastifyInstance) {
  app.post("/ai-references/upload", async (req, reply) => {
    const user = await getSessionUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    let workspaceId: string | undefined;
    let file: { buffer: Buffer; filename: string; mimetype: string } | undefined;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        file = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype };
      } else if (part.fieldname === "workspaceId" && typeof part.value === "string") {
        workspaceId = part.value;
      }
    }

    if (!workspaceId || !file) {
      return reply.code(400).send({ error: "Missing file or workspaceId" });
    }
    if (file.buffer.byteLength > MAX_BYTES) {
      return reply.code(400).send({ error: "File too large (max 50MB)" });
    }

    const role = await getMembershipRole(workspaceId, user.id);
    // Same tier as attaching files to work — members can drop references.
    if (!can(user, "attachment:create", { type: "workspace", role })) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const attachmentId = uuidv7();
    const originalKey = `ai-references/${workspaceId}/${attachmentId}/${sanitizeFilenameForKey(file.filename)}`;
    await putObject(originalKey, file.buffer, file.mimetype);

    let imageAssetId: string | null = null;
    let imageVersionId: string | null = null;
    let thumbKey: string | null = null;
    let blurhash: string | null = null;
    let width: number | null = null;
    let height: number | null = null;

    if (file.mimetype.startsWith("image/")) {
      const processed = await processImage(file.buffer);
      if (processed) {
        const assetId = uuidv7();
        const versionId = uuidv7();
        const assetOriginalKey = `image-assets/${workspaceId}/${assetId}/${sanitizeFilenameForKey(file.filename)}`;
        thumbKey = `image-assets/${workspaceId}/${assetId}/thumb.webp`;
        await putObject(assetOriginalKey, file.buffer, file.mimetype);
        await putObject(thumbKey, processed.thumbBuffer, processed.thumbContentType);
        ({ blurhash, width, height } = processed);

        const altText =
          file.filename
            .replace(/\.[^./]+$/, "")
            .trim()
            .slice(0, 200) || null;

        await db.insert(schema.imageAssets).values({
          id: assetId,
          workspaceId,
          createdBy: user.id,
          origin: "upload",
          altText,
        });
        await db.insert(schema.imageVersions).values({
          id: versionId,
          assetId,
          source: "upload",
          provider: "upload",
          model: "n/a",
          fileKey: assetOriginalKey,
          thumbKey,
          blurhash,
          width,
          height,
          createdBy: user.id,
        });
        await db
          .update(schema.imageAssets)
          .set({ currentVersionId: versionId, updatedAt: new Date() })
          .where(eq(schema.imageAssets.id, assetId));

        imageAssetId = assetId;
        imageVersionId = versionId;
        await logActivity(workspaceId, user.id, "image_asset", assetId, "image_asset.uploaded");
      }
    }

    await db.insert(schema.attachments).values({
      id: attachmentId,
      workspaceId,
      uploaderId: user.id,
      imageAssetId,
      fileKey: originalKey,
      fileName: file.filename,
      mime: file.mimetype,
      sizeBytes: file.buffer.byteLength,
      thumbKey,
      blurhash,
      width,
      height,
    });

    await logActivity(workspaceId, user.id, "attachment", attachmentId, "ai_reference.uploaded", {
      mime: file.mimetype,
      fileName: file.filename,
    });

    return reply.send({
      id: attachmentId,
      fileName: file.filename,
      mime: file.mimetype,
      sizeBytes: file.buffer.byteLength,
      imageAssetId,
      imageVersionId,
    });
  });
}

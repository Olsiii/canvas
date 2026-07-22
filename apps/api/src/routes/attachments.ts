import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Readable } from "node:stream";
import { uuidv7 } from "uuidv7";
import { getSessionUser } from "../auth/session";
import { can } from "../auth/can";
import { logActivity } from "../lib/activity";
import { processImage } from "../lib/image-processing";
import { getMembershipRole } from "../lib/membership";
import { getObject, putObject } from "../lib/storage";
import { requireTask, workspaceIdForTask } from "../lib/task-queries";

// File upload/download is a plain multipart/binary REST route, not a tRPC
// procedure — tRPC has no native file-transport support. See PROGRESS.md
// (M1.9 decisions).
export function registerAttachmentRoutes(app: FastifyInstance) {
  app.post("/uploads", async (req, reply) => {
    const user = await getSessionUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    let taskId: string | undefined;
    let file: { buffer: Buffer; filename: string; mimetype: string } | undefined;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        file = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype };
      } else if (part.fieldname === "taskId" && typeof part.value === "string") {
        taskId = part.value;
      }
    }

    if (!taskId || !file) {
      return reply.code(400).send({ error: "Missing file or taskId" });
    }

    const task = await requireTask(taskId).catch(() => null);
    if (!task) return reply.code(404).send({ error: "Task not found" });

    const workspaceId = await workspaceIdForTask(taskId);
    const role = await getMembershipRole(workspaceId, user.id);
    if (!can(user, "attachment:create", { type: "workspace", role })) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    // Generated up front (rather than letting the DB default it) since the
    // S3 key namespaces objects by attachment id and must be known before
    // the row is inserted — one insert, no partial/placeholder row.
    const attachmentId = uuidv7();
    const originalKey = `attachments/${workspaceId}/${attachmentId}/${file.filename}`;
    await putObject(originalKey, file.buffer, file.mimetype);

    let thumbKey: string | null = null;
    let blurhash: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    if (file.mimetype.startsWith("image/")) {
      const processed = await processImage(file.buffer);
      if (processed) {
        thumbKey = `attachments/${workspaceId}/${attachmentId}/thumb.webp`;
        await putObject(thumbKey, processed.thumbBuffer, processed.thumbContentType);
        ({ blurhash, width, height } = processed);
      }
    }

    const [attachment] = await db
      .insert(schema.attachments)
      .values({
        id: attachmentId,
        workspaceId,
        taskId,
        uploaderId: user.id,
        fileKey: originalKey,
        fileName: file.filename,
        mime: file.mimetype,
        sizeBytes: file.buffer.byteLength,
        thumbKey,
        blurhash,
        width,
        height,
      })
      .returning();
    if (!attachment) return reply.code(500).send({ error: "Failed to save attachment" });

    await logActivity(workspaceId, user.id, "attachment", attachment.id, "attachment.created");

    return reply.send(attachment);
  });

  app.get<{ Params: { attachmentId: string } }>("/uploads/:attachmentId", (req, reply) =>
    streamAttachment(req, reply, "file"),
  );

  app.get<{ Params: { attachmentId: string } }>("/uploads/:attachmentId/thumb", (req, reply) =>
    streamAttachment(req, reply, "thumb"),
  );
}

async function streamAttachment(
  req: FastifyRequest<{ Params: { attachmentId: string } }>,
  reply: FastifyReply,
  kind: "file" | "thumb",
) {
  const user = await getSessionUser(req);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });

  const attachment = await db.query.attachments.findFirst({
    where: eq(schema.attachments.id, req.params.attachmentId),
  });
  if (!attachment) return reply.code(404).send({ error: "Not found" });

  const role = await getMembershipRole(attachment.workspaceId, user.id);
  if (!can(user, "attachment:view", { type: "workspace", role })) {
    return reply.code(403).send({ error: "Forbidden" });
  }

  const key = kind === "thumb" ? attachment.thumbKey : attachment.fileKey;
  if (!key) return reply.code(404).send({ error: "Not found" });

  const object = await getObject(key);
  reply.header("Content-Type", object.ContentType ?? attachment.mime);
  reply.header("Cache-Control", "private, max-age=3600");
  // Video playback (M4.6 clips) needs a known length upfront to report
  // duration/seek correctly — images/other files get it for free too.
  if (object.ContentLength !== undefined) {
    reply.header("Content-Length", String(object.ContentLength));
  }
  if (kind === "file") {
    reply.header("Content-Disposition", `inline; filename="${attachment.fileName}"`);
  }
  return reply.send(object.Body as Readable);
}

import { db, schema } from "@canvas/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Readable } from "node:stream";
import { uuidv7 } from "uuidv7";
import { getSessionUser } from "../auth/session";
import { can } from "../auth/can";
import { logActivity } from "../lib/activity";
import { isChannelMember, requireChannel, requireMessage } from "../lib/chat-queries";
import { sanitizeFilenameForKey, sanitizeForHeader } from "../lib/filename";
import { processImage } from "../lib/image-processing";
import { isInlineSafeMimeType, safeContentType } from "../lib/mime-safety";
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
    let messageId: string | undefined;
    let file: { buffer: Buffer; filename: string; mimetype: string } | undefined;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        file = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype };
      } else if (part.fieldname === "taskId" && typeof part.value === "string") {
        taskId = part.value;
      } else if (part.fieldname === "messageId" && typeof part.value === "string") {
        messageId = part.value;
      }
    }

    if ((!taskId && !messageId) || !file) {
      return reply.code(400).send({ error: "Missing file, and taskId or messageId" });
    }

    let workspaceId: string;
    if (messageId) {
      const message = await requireMessage(messageId).catch(() => null);
      if (!message) return reply.code(404).send({ error: "Message not found" });
      const channel = await requireChannel(message.channelId);
      workspaceId = channel.workspaceId;
      const role = await getMembershipRole(workspaceId, user.id);
      if (!can(user, "message:create", { type: "workspace", role })) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      if (channel.isPrivate && !(await isChannelMember(channel.id, user.id))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
    } else {
      const task = await requireTask(taskId!).catch(() => null);
      if (!task) return reply.code(404).send({ error: "Task not found" });
      workspaceId = await workspaceIdForTask(taskId!);
      const role = await getMembershipRole(workspaceId, user.id);
      if (!can(user, "attachment:create", { type: "workspace", role })) {
        return reply.code(403).send({ error: "Forbidden" });
      }
    }

    // Generated up front (rather than letting the DB default it) since the
    // S3 key namespaces objects by attachment id and must be known before
    // the row is inserted — one insert, no partial/placeholder row.
    const attachmentId = uuidv7();
    const originalKey = `attachments/${workspaceId}/${attachmentId}/${sanitizeFilenameForKey(file.filename)}`;
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
        taskId: taskId ?? null,
        messageId: messageId ?? null,
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

  // Public, unauthenticated counterpart to POST /uploads above — for a
  // task-bound form's external submitter (form.ts's getPublic/submitPublic
  // never require a session either), gated by the form's own publicToken
  // instead of getSessionUser. Same trust boundary the rest of forms.md's
  // public surface already accepts: anyone with the link can act on it.
  app.post("/public-forms/uploads", async (req, reply) => {
    let publicToken: string | undefined;
    let file: { buffer: Buffer; filename: string; mimetype: string } | undefined;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        file = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype };
      } else if (part.fieldname === "publicToken" && typeof part.value === "string") {
        publicToken = part.value;
      }
    }

    if (!publicToken || !file) {
      return reply.code(400).send({ error: "Missing file or publicToken" });
    }

    const form = await db.query.forms.findFirst({
      where: eq(schema.forms.publicToken, publicToken),
    });
    if (!form) return reply.code(404).send({ error: "Form not found" });
    if (!form.taskId) return reply.code(400).send({ error: "This form isn't bound to a task" });

    const task = await requireTask(form.taskId).catch(() => null);
    if (!task) return reply.code(404).send({ error: "Task not found" });

    const attachmentId = uuidv7();
    const originalKey = `attachments/${form.workspaceId}/${attachmentId}/${sanitizeFilenameForKey(file.filename)}`;
    await putObject(originalKey, file.buffer, file.mimetype);

    let thumbKey: string | null = null;
    let blurhash: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    if (file.mimetype.startsWith("image/")) {
      const processed = await processImage(file.buffer);
      if (processed) {
        thumbKey = `attachments/${form.workspaceId}/${attachmentId}/thumb.webp`;
        await putObject(thumbKey, processed.thumbBuffer, processed.thumbContentType);
        ({ blurhash, width, height } = processed);
      }
    }

    const [attachment] = await db
      .insert(schema.attachments)
      .values({
        id: attachmentId,
        workspaceId: form.workspaceId,
        taskId: form.taskId,
        uploaderId: form.createdBy,
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

    await logActivity(
      form.workspaceId,
      form.createdBy,
      "attachment",
      attachment.id,
      "attachment.created",
    );

    return reply.send({
      id: attachment.id,
      fileName: attachment.fileName,
      mime: attachment.mime,
      sizeBytes: attachment.sizeBytes,
    });
  });

  app.get<{ Params: { attachmentId: string }; Querystring: { download?: string } }>(
    "/uploads/:attachmentId",
    (req, reply) => streamAttachment(req, reply, "file"),
  );

  app.get<{ Params: { attachmentId: string } }>("/uploads/:attachmentId/thumb", (req, reply) =>
    streamAttachment(req, reply, "thumb"),
  );
}

async function streamAttachment(
  req: FastifyRequest<{ Params: { attachmentId: string }; Querystring?: { download?: string } }>,
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
  // A workspace-level "can view attachments" pass isn't enough on its own
  // for a message attachment — it would let any workspace member fetch a
  // private channel's files by attachment id alone, bypassing the same
  // channel-membership gate every other message-reading path enforces.
  if (attachment.messageId) {
    const message = await requireMessage(attachment.messageId);
    const channel = await requireChannel(message.channelId);
    if (channel.isPrivate && !(await isChannelMember(channel.id, user.id))) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  }

  const key = kind === "thumb" ? attachment.thumbKey : attachment.fileKey;
  if (!key) return reply.code(404).send({ error: "Not found" });

  const object = await getObject(key);
  const rawContentType = object.ContentType ?? attachment.mime;
  // Thumbnails are always server-generated (processImage → webp), so their
  // content type is trustworthy regardless; the original "file" upload's
  // mime came straight from the uploader's multipart request and is never
  // verified against the actual bytes — serving it back with that claimed
  // type, inline, is a stored-XSS vector (upload text/html or
  // image/svg+xml with a <script>, then open the file's direct URL).
  const inlineSafe = kind === "thumb" || isInlineSafeMimeType(rawContentType);
  reply.header("Content-Type", inlineSafe ? rawContentType : safeContentType(rawContentType));
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Cache-Control", "private, max-age=3600");
  // Video playback (M4.6 clips) needs a known length upfront to report
  // duration/seek correctly — images/other files get it for free too.
  if (object.ContentLength !== undefined) {
    reply.header("Content-Length", String(object.ContentLength));
  }
  if (kind === "file") {
    const disposition = req.query?.download || !inlineSafe ? "attachment" : "inline";
    reply.header(
      "Content-Disposition",
      `${disposition}; filename="${sanitizeForHeader(attachment.fileName)}"`,
    );
  }
  return reply.send(object.Body as Readable);
}

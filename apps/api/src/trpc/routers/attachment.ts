import { db, schema } from "@canvas/db";
import {
  attachExternalSchema,
  deleteAttachmentSchema,
  listAttachmentsSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { parseDriveLink } from "../../lib/drive-link";
import { assertCan } from "../../lib/permissions";
import { deleteObject } from "../../lib/storage";
import { requireTask, workspaceIdForTask } from "../../lib/task-queries";
import { protectedProcedure, router } from "../trpc";

export const attachmentRouter = router({
  list: protectedProcedure.input(listAttachmentsSchema).query(async ({ ctx, input }) => {
    const workspaceId = await workspaceIdForTask(input.taskId);
    await assertCan(ctx.user, workspaceId, "attachment:view");

    return db.query.attachments.findMany({
      where: eq(schema.attachments.taskId, input.taskId),
      orderBy: asc(schema.attachments.createdAt),
    });
  }),

  delete: protectedProcedure.input(deleteAttachmentSchema).mutation(async ({ ctx, input }) => {
    const attachment = await db.query.attachments.findFirst({
      where: eq(schema.attachments.id, input.attachmentId),
    });
    if (!attachment) throw new TRPCError({ code: "NOT_FOUND" });
    await assertCan(ctx.user, attachment.workspaceId, "attachment:delete");

    await db.delete(schema.attachments).where(eq(schema.attachments.id, attachment.id));
    // A "google_drive" source attachment has no S3 object of its own.
    if (attachment.fileKey) await deleteObject(attachment.fileKey);
    if (attachment.thumbKey) await deleteObject(attachment.thumbKey);

    await logActivity(
      attachment.workspaceId,
      ctx.user.id,
      "attachment",
      attachment.id,
      "attachment.deleted",
    );
    return { id: attachment.id };
  }),

  // M5.6 Google Drive "picker": a plain tRPC mutation (unlike /uploads —
  // no file bytes cross the wire, just the Drive file's own link/name/
  // mime), see PROGRESS.md decisions.
  attachExternal: protectedProcedure
    .input(attachExternalSchema)
    .mutation(async ({ ctx, input }) => {
      const task = await requireTask(input.taskId);
      const workspaceId = await workspaceIdForTask(input.taskId);
      await assertCan(ctx.user, workspaceId, "attachment:create");

      const { canonicalUrl } = parseDriveLink(input.url);

      const [attachment] = await db
        .insert(schema.attachments)
        .values({
          workspaceId,
          taskId: task.id,
          uploaderId: ctx.user.id,
          source: "google_drive",
          fileName: input.fileName,
          mime: input.mime ?? "application/vnd.google-apps.file",
          externalUrl: canonicalUrl,
        })
        .returning();
      if (!attachment) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await logActivity(
        workspaceId,
        ctx.user.id,
        "attachment",
        attachment.id,
        "attachment.created",
        {
          source: "google_drive",
        },
      );
      return attachment;
    }),
});

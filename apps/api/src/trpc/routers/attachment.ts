import { db, schema } from "@canvas/db";
import { deleteAttachmentSchema, listAttachmentsSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { assertCan } from "../../lib/permissions";
import { deleteObject } from "../../lib/storage";
import { workspaceIdForTask } from "../../lib/task-queries";
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
    await deleteObject(attachment.fileKey);
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
});

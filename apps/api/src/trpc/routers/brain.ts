import { db, schema } from "@canvas/db";
import {
  getOrCreateBrainConversationSchema,
  listBrainMessagesSchema,
  sendBrainMessageSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { assertCan } from "../../lib/permissions";
import { requireTask, workspaceIdForTask } from "../../lib/task-queries";
import { brainQueue } from "../../queues/brain-queue";
import { protectedProcedure, router } from "../trpc";

async function requireConversation(conversationId: string) {
  const conversation = await db.query.brainConversations.findFirst({
    where: eq(schema.brainConversations.id, conversationId),
  });
  if (!conversation) throw new TRPCError({ code: "NOT_FOUND" });
  return conversation;
}

// Conversations are per-user (Ada's Brain chat about a task is private to
// Ada — see PROGRESS.md M2.2 decisions), so ownership is checked directly
// by id comparison rather than through can() — an ownership check, not a
// role decision, same pattern M1.7's comment.delete already established.
function assertOwnsConversation(userId: string, conversation: { createdBy: string }) {
  if (conversation.createdBy !== userId) throw new TRPCError({ code: "FORBIDDEN" });
}

export const brainRouter = router({
  getOrCreateConversation: protectedProcedure
    .input(getOrCreateBrainConversationSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "brain:view");

      if (input.contextType === "task") {
        if (!input.contextId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "contextId is required for task" });
        }
        const task = await requireTask(input.contextId);
        const taskWorkspaceId = await workspaceIdForTask(task.id);
        if (taskWorkspaceId !== input.workspaceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task does not belong to this workspace",
          });
        }
      }

      const lookup = and(
        eq(schema.brainConversations.workspaceId, input.workspaceId),
        eq(schema.brainConversations.contextType, input.contextType),
        input.contextId
          ? eq(schema.brainConversations.contextId, input.contextId)
          : isNull(schema.brainConversations.contextId),
        eq(schema.brainConversations.createdBy, ctx.user.id),
      );

      const existing = await db.query.brainConversations.findFirst({ where: lookup });
      if (existing) return existing;

      // Two concurrent calls (e.g. React StrictMode's double-invoked mount
      // effect) can both reach here with no existing row and both attempt
      // to insert — the partial unique indexes on brainConversations make
      // the loser's insert a no-op instead of a duplicate row, and it falls
      // back to fetching the winner's row instead of erroring.
      const [created] = await db
        .insert(schema.brainConversations)
        .values({
          workspaceId: input.workspaceId,
          contextType: input.contextType,
          contextId: input.contextId ?? null,
          createdBy: ctx.user.id,
        })
        .onConflictDoNothing()
        .returning();

      if (created) {
        await logActivity(
          input.workspaceId,
          ctx.user.id,
          "brain_conversation",
          created.id,
          "brain.conversation_created",
          { contextType: input.contextType, contextId: input.contextId ?? null },
        );
        return created;
      }

      const winner = await db.query.brainConversations.findFirst({ where: lookup });
      if (!winner) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return winner;
    }),

  messages: router({
    list: protectedProcedure.input(listBrainMessagesSchema).query(async ({ ctx, input }) => {
      const conversation = await requireConversation(input.conversationId);
      assertOwnsConversation(ctx.user.id, conversation);

      return db.query.brainMessages.findMany({
        where: eq(schema.brainMessages.conversationId, conversation.id),
        orderBy: asc(schema.brainMessages.createdAt),
      });
    }),

    send: protectedProcedure.input(sendBrainMessageSchema).mutation(async ({ ctx, input }) => {
      const conversation = await requireConversation(input.conversationId);
      assertOwnsConversation(ctx.user.id, conversation);
      await assertCan(ctx.user, conversation.workspaceId, "brain:chat");

      await db.insert(schema.brainMessages).values({
        conversationId: conversation.id,
        role: "user",
        contentJson: { text: input.text },
      });

      await logActivity(
        conversation.workspaceId,
        ctx.user.id,
        "brain_conversation",
        conversation.id,
        "brain.message_sent",
      );

      // The actual Claude call happens in the worker, never here — CLAUDE.md
      // hard rule: "All external AI calls... run in BullMQ workers — never
      // in request handlers."
      await brainQueue.add("chat", {
        conversationId: conversation.id,
        workspaceId: conversation.workspaceId,
        userId: ctx.user.id,
      });

      return { ok: true };
    }),
  }),
});

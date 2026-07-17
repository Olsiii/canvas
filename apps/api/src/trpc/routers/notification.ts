import { db, schema } from "@canvas/db";
import { markNotificationReadSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { protectedProcedure, router } from "../trpc";

// No assertCan here: notifications are scoped strictly to the requesting
// user's own rows (userId = ctx.user.id), not a workspace-role decision —
// membership was already checked when the notification was created (see
// comment.create's mentioned-member filter).
export const notificationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: schema.notifications.id,
        readAt: schema.notifications.readAt,
        createdAt: schema.notifications.createdAt,
        verb: schema.activity.verb,
        entityType: schema.activity.entityType,
        entityId: schema.activity.entityId,
        payloadJson: schema.activity.payloadJson,
        workspaceId: schema.activity.workspaceId,
        actorName: schema.users.name,
      })
      .from(schema.notifications)
      .innerJoin(schema.activity, eq(schema.activity.id, schema.notifications.activityId))
      .innerJoin(schema.users, eq(schema.users.id, schema.activity.actorId))
      .where(eq(schema.notifications.userId, ctx.user.id))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50);
  }),

  markRead: protectedProcedure
    .input(markNotificationReadSchema)
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(schema.notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(schema.notifications.id, input.notificationId),
            eq(schema.notifications.userId, ctx.user.id),
          ),
        )
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(schema.notifications.userId, ctx.user.id), isNull(schema.notifications.readAt)),
      );
    return { ok: true as const };
  }),
});

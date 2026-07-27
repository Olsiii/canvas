import { db, schema } from "@canvas/db";
import {
  addChannelMemberSchema,
  createChannelSchema,
  createMessageSchema,
  deleteMessageSchema,
  getChannelSchema,
  listChannelMembersSchema,
  listChannelsSchema,
  listMessagesSchema,
  removeChannelMemberSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { isChannelMember, requireChannel, requireMessage } from "../../lib/chat-queries";
import { getMembershipRole } from "../../lib/membership";
import { extractMentionedUserIds } from "../../lib/mentions";
import { notifyUsers } from "../../lib/notify";
import { validateMessageParent } from "../../lib/message-thread";
import { assertCan } from "../../lib/permissions";
import { publish } from "../../lib/realtime";
import { protectedProcedure, router } from "../trpc";

export const chatRouter = router({
  channel: router({
    list: protectedProcedure.input(listChannelsSchema).query(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "channel:view");

      const myMemberships = await db
        .select({ channelId: schema.channelMembers.channelId })
        .from(schema.channelMembers)
        .where(eq(schema.channelMembers.userId, ctx.user.id));
      const myChannelIds = myMemberships.map((m) => m.channelId);

      const visible = or(
        eq(schema.channels.isPrivate, false),
        myChannelIds.length > 0 ? inArray(schema.channels.id, myChannelIds) : undefined,
      );

      return db.query.channels.findMany({
        where: and(
          eq(schema.channels.workspaceId, input.workspaceId),
          isNull(schema.channels.deletedAt),
          visible,
        ),
        orderBy: asc(schema.channels.name),
      });
    }),

    get: protectedProcedure.input(getChannelSchema).query(async ({ ctx, input }) => {
      const channel = await requireChannel(input.channelId);
      await assertCan(ctx.user, channel.workspaceId, "channel:view");
      if (channel.isPrivate && !(await isChannelMember(channel.id, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return channel;
    }),

    create: protectedProcedure.input(createChannelSchema).mutation(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "channel:create");

      const [channel] = await db
        .insert(schema.channels)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          isPrivate: input.isPrivate,
        })
        .returning();
      if (!channel) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .insert(schema.channelMembers)
        .values({ channelId: channel.id, userId: ctx.user.id })
        .onConflictDoNothing();

      await logActivity(input.workspaceId, ctx.user.id, "channel", channel.id, "channel.created");
      return channel;
    }),

    members: router({
      list: protectedProcedure.input(listChannelMembersSchema).query(async ({ ctx, input }) => {
        const channel = await requireChannel(input.channelId);
        await assertCan(ctx.user, channel.workspaceId, "channel:view");
        if (channel.isPrivate && !(await isChannelMember(channel.id, ctx.user.id))) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        return db
          .select({
            userId: schema.channelMembers.userId,
            name: schema.users.name,
            avatarUrl: schema.users.avatarUrl,
          })
          .from(schema.channelMembers)
          .innerJoin(schema.users, eq(schema.users.id, schema.channelMembers.userId))
          .where(eq(schema.channelMembers.channelId, channel.id))
          .orderBy(asc(schema.users.name));
      }),

      add: protectedProcedure.input(addChannelMemberSchema).mutation(async ({ ctx, input }) => {
        const channel = await requireChannel(input.channelId);
        await assertCan(ctx.user, channel.workspaceId, "channel:view");
        if (channel.isPrivate && !(await isChannelMember(channel.id, ctx.user.id))) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }

        const targetRole = await getMembershipRole(channel.workspaceId, input.userId);
        if (!targetRole) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "User is not a workspace member" });
        }

        await db
          .insert(schema.channelMembers)
          .values({ channelId: channel.id, userId: input.userId })
          .onConflictDoNothing();

        await logActivity(
          channel.workspaceId,
          ctx.user.id,
          "channel",
          channel.id,
          "channel.member_added",
          {
            userId: input.userId,
          },
        );
        return { ok: true as const };
      }),

      remove: protectedProcedure
        .input(removeChannelMemberSchema)
        .mutation(async ({ ctx, input }) => {
          const channel = await requireChannel(input.channelId);
          await assertCan(ctx.user, channel.workspaceId, "channel:view");
          if (channel.isPrivate && !(await isChannelMember(channel.id, ctx.user.id))) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }

          await db
            .delete(schema.channelMembers)
            .where(
              and(
                eq(schema.channelMembers.channelId, channel.id),
                eq(schema.channelMembers.userId, input.userId),
              ),
            );

          await logActivity(
            channel.workspaceId,
            ctx.user.id,
            "channel",
            channel.id,
            "channel.member_removed",
            {
              userId: input.userId,
            },
          );
          return { ok: true as const };
        }),
    }),
  }),

  message: router({
    list: protectedProcedure.input(listMessagesSchema).query(async ({ ctx, input }) => {
      const channel = await requireChannel(input.channelId);
      await assertCan(ctx.user, channel.workspaceId, "channel:view");
      if (channel.isPrivate && !(await isChannelMember(channel.id, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const rows = await db
        .select({
          id: schema.messages.id,
          channelId: schema.messages.channelId,
          parentMessageId: schema.messages.parentMessageId,
          authorId: schema.messages.authorId,
          bodyJson: schema.messages.bodyJson,
          createdAt: schema.messages.createdAt,
          authorName: schema.users.name,
          authorAvatarUrl: schema.users.avatarUrl,
        })
        .from(schema.messages)
        .innerJoin(schema.users, eq(schema.users.id, schema.messages.authorId))
        .where(
          and(eq(schema.messages.channelId, input.channelId), isNull(schema.messages.deletedAt)),
        )
        .orderBy(asc(schema.messages.createdAt));

      const attachmentsByMessage = new Map<string, (typeof schema.attachments.$inferSelect)[]>();
      if (rows.length > 0) {
        const attachmentRows = await db.query.attachments.findMany({
          where: inArray(
            schema.attachments.messageId,
            rows.map((r) => r.id),
          ),
        });
        for (const a of attachmentRows) {
          if (!a.messageId) continue;
          const list = attachmentsByMessage.get(a.messageId) ?? [];
          list.push(a);
          attachmentsByMessage.set(a.messageId, list);
        }
      }

      return rows.map((r) => ({
        id: r.id,
        channelId: r.channelId,
        parentMessageId: r.parentMessageId,
        authorId: r.authorId,
        bodyJson: r.bodyJson,
        createdAt: r.createdAt,
        author: { id: r.authorId, name: r.authorName, avatarUrl: r.authorAvatarUrl },
        attachments: attachmentsByMessage.get(r.id) ?? [],
      }));
    }),

    create: protectedProcedure.input(createMessageSchema).mutation(async ({ ctx, input }) => {
      const channel = await requireChannel(input.channelId);
      await assertCan(ctx.user, channel.workspaceId, "message:create");
      if (channel.isPrivate && !(await isChannelMember(channel.id, ctx.user.id))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      let parentMessageId: string | undefined;
      if (input.parentMessageId) {
        const parent = await requireMessage(input.parentMessageId);
        const error = validateMessageParent(parent, input.channelId);
        if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
        parentMessageId = parent.id;
      }

      const [message] = await db
        .insert(schema.messages)
        .values({
          channelId: channel.id,
          parentMessageId,
          authorId: ctx.user.id,
          bodyJson: input.bodyJson,
        })
        .returning();
      if (!message) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const activityRow = await logActivity(
        channel.workspaceId,
        ctx.user.id,
        "message",
        message.id,
        "message.created",
        { channelId: channel.id },
      );

      const mentionedUserIds = extractMentionedUserIds(input.bodyJson).filter(
        (id) => id !== ctx.user.id,
      );
      if (mentionedUserIds.length > 0) {
        const members = await db
          .select({ userId: schema.memberships.userId })
          .from(schema.memberships)
          .where(
            and(
              eq(schema.memberships.workspaceId, channel.workspaceId),
              inArray(schema.memberships.userId, mentionedUserIds),
            ),
          );
        await notifyUsers(
          activityRow.id,
          members.map((m) => m.userId),
        );
      }

      await publish(channel.workspaceId, {
        entity: "message",
        id: message.id,
        channelId: channel.id,
        kind: "created",
      });

      return message;
    }),

    delete: protectedProcedure.input(deleteMessageSchema).mutation(async ({ ctx, input }) => {
      const message = await requireMessage(input.messageId);
      const channel = await requireChannel(message.channelId);
      await assertCan(ctx.user, channel.workspaceId, "message:create");
      if (message.authorId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own messages",
        });
      }

      await db
        .update(schema.messages)
        .set({ deletedAt: new Date() })
        .where(eq(schema.messages.id, message.id));

      await logActivity(channel.workspaceId, ctx.user.id, "message", message.id, "message.deleted");
      await publish(channel.workspaceId, {
        entity: "message",
        id: message.id,
        channelId: channel.id,
        kind: "deleted",
      });

      return { id: message.id };
    }),
  }),
});

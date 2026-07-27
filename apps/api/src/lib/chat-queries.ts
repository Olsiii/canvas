import { db, schema } from "@canvas/db";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

export async function requireChannel(channelId: string) {
  const channel = await db.query.channels.findFirst({
    where: and(eq(schema.channels.id, channelId), isNull(schema.channels.deletedAt)),
  });
  if (!channel) throw new TRPCError({ code: "NOT_FOUND" });
  return channel;
}

export async function isChannelMember(channelId: string, userId: string) {
  const row = await db.query.channelMembers.findFirst({
    where: and(
      eq(schema.channelMembers.channelId, channelId),
      eq(schema.channelMembers.userId, userId),
    ),
  });
  return !!row;
}

export async function requireMessage(messageId: string) {
  const message = await db.query.messages.findFirst({
    where: and(eq(schema.messages.id, messageId), isNull(schema.messages.deletedAt)),
  });
  if (!message) throw new TRPCError({ code: "NOT_FOUND" });
  return message;
}

// Chat attachments (attachment.ts, routes/attachments.ts) need "which
// workspace does this message live in" the same way task-queries.ts's
// workspaceIdForTask does for tasks.
export async function workspaceIdForMessage(messageId: string) {
  const message = await requireMessage(messageId);
  const channel = await requireChannel(message.channelId);
  return channel.workspaceId;
}

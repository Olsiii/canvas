import { db, schema } from "@canvas/db";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";

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

// Batched lookup of "who's the other person" for a set of DM channels, keyed
// by channelId — used by chat.dm.list to avoid an N+1 query (one join per
// row) when rendering the DM sidebar. A DM channel always has exactly 2
// members (fixed at chat.dm.startOrGet time), so excluding `excludeUserId`
// always leaves exactly one row per channel.
export async function otherDmParticipants(channelIds: string[], excludeUserId: string) {
  if (channelIds.length === 0)
    return new Map<string, { id: string; name: string; avatarUrl: string | null }>();

  const rows = await db
    .select({
      channelId: schema.channelMembers.channelId,
      id: schema.users.id,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.channelMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.channelMembers.userId))
    .where(
      and(
        inArray(schema.channelMembers.channelId, channelIds),
        ne(schema.channelMembers.userId, excludeUserId),
      ),
    );

  const byChannel = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
  for (const r of rows) {
    byChannel.set(r.channelId, { id: r.id, name: r.name, avatarUrl: r.avatarUrl });
  }
  return byChannel;
}

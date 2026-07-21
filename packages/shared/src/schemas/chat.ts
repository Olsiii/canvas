import { z } from "zod";

export const listChannelsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const createChannelSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  isPrivate: z.boolean().default(false),
});

export const getChannelSchema = z.object({
  channelId: z.string().uuid(),
});

export const addChannelMemberSchema = z.object({
  channelId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const removeChannelMemberSchema = z.object({
  channelId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const listMessagesSchema = z.object({
  channelId: z.string().uuid(),
});

export const createMessageSchema = z.object({
  channelId: z.string().uuid(),
  // A reply's parent. Threading is capped at depth 2 (a reply cannot itself
  // be replied to) — enforced server-side, same rule as comments.
  parentMessageId: z.string().uuid().optional(),
  // TipTap document JSON — never an HTML string. Mentioned users are
  // extracted server-side from the document's mention nodes.
  bodyJson: z.unknown(),
});

export const deleteMessageSchema = z.object({
  messageId: z.string().uuid(),
});

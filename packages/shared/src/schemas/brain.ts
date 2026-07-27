import { z } from "zod";

// contextId required for 'task', 'doc', and 'channel'; omitted for 'global'.
export const getOrCreateBrainConversationSchema = z.object({
  workspaceId: z.string().uuid(),
  contextType: z.enum(["task", "doc", "channel", "global"]),
  contextId: z.string().uuid().optional(),
});

export const listBrainMessagesSchema = z.object({
  conversationId: z.string().uuid(),
});

export const sendBrainMessageSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().trim().min(1).max(8000),
});

export const setBrainConversationBrandKitSchema = z.object({
  conversationId: z.string().uuid(),
  brandKitId: z.string().uuid().nullable(),
});

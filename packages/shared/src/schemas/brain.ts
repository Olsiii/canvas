import { z } from "zod";

// contextId required for 'task' and 'doc'; omitted for 'global'.
// 'channel' waits on M4.3.
export const getOrCreateBrainConversationSchema = z.object({
  workspaceId: z.string().uuid(),
  contextType: z.enum(["task", "doc", "global"]),
  contextId: z.string().uuid().optional(),
});

export const listBrainMessagesSchema = z.object({
  conversationId: z.string().uuid(),
});

export const sendBrainMessageSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().trim().min(1).max(8000),
});

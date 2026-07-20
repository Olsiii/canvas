import { z } from "zod";

// M2.2 only ever creates 'task' or 'global' conversations — 'doc'/'channel'
// have no UI trigger yet (Docs is M4.1, Chat is M4.3). contextId is required
// for 'task' (the task id), omitted for 'global'.
export const getOrCreateBrainConversationSchema = z.object({
  workspaceId: z.string().uuid(),
  contextType: z.enum(["task", "global"]),
  contextId: z.string().uuid().optional(),
});

export const listBrainMessagesSchema = z.object({
  conversationId: z.string().uuid(),
});

export const sendBrainMessageSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().trim().min(1).max(8000),
});

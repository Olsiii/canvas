import { z } from "zod";

// ARCHITECTURE.md: "server emits { entity: 'task', id, listId, kind:
// 'updated' }; clients invalidate queries. No payloads over WS in Phase 1."
export const REALTIME_ENTITIES = ["task", "status"] as const;
export const REALTIME_KINDS = ["created", "updated", "deleted"] as const;

export const realtimeEventSchema = z.object({
  entity: z.enum(REALTIME_ENTITIES),
  id: z.string().uuid(),
  listId: z.string().uuid(),
  kind: z.enum(REALTIME_KINDS),
});

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

// A separate WS channel (/ws/brain?conversationId=...), not the workspace
// board-invalidation channel above — Phase 1's realtime protocol is
// deliberately payload-free ("no payloads over WS in Phase 1"); brain chat
// needs to carry actual message text, which is a genuinely different
// concern with its own connection lifecycle (open only while a chat panel
// is mounted, vs. the board channel's whole-session connection). See
// PROGRESS.md (M2.2 decisions).
export const brainStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("done"), messageId: z.string().uuid() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export type BrainStreamEvent = z.infer<typeof brainStreamEventSchema>;

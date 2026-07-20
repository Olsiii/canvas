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

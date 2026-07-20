// Kept separate from the db pgEnum and hand-synced, matching the existing
// STATUS_KINDS/MEMBERSHIP_ROLES pattern. The DB enum has all four contexts
// DATA_MODEL.md specifies; the tRPC-facing schema (schemas/brain.ts)
// restricts to the two M2.2 actually builds — see PROGRESS.md.
export const BRAIN_CONTEXT_TYPES = ["task", "doc", "channel", "global"] as const;
export type BrainContextType = (typeof BRAIN_CONTEXT_TYPES)[number];

export const STATUS_KINDS = ["open", "active", "done", "closed"] as const;
export type StatusKind = (typeof STATUS_KINDS)[number];

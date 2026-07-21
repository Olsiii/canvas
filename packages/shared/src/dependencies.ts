export const TASK_DEPENDENCY_KINDS = ["blocks", "waiting_on"] as const;
export type TaskDependencyKind = (typeof TASK_DEPENDENCY_KINDS)[number];

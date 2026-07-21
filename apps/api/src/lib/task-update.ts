import type { TaskPriority } from "@canvas/shared";
import { extractPlainText } from "./plain-text";

/**
 * Builds the Drizzle `.set()` fields for a task update. Each field is
 * independently optional — a caller changing only `orderKey` (e.g. a
 * same-column drag reorder) must not silently drop that change just because
 * `statusId` didn't also change, and vice versa. `null` clears a nullable
 * field (e.g. removing a due date); `undefined` leaves it untouched.
 */
export function buildTaskUpdateFields(input: {
  title?: string;
  statusId?: string;
  orderKey?: string;
  descriptionJson?: unknown | null;
  priority?: TaskPriority | null;
  startDate?: string | null;
  dueDate?: string | null;
  isMilestone?: boolean;
}) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
    ...(input.orderKey !== undefined ? { orderKey: input.orderKey } : {}),
    ...(input.descriptionJson !== undefined
      ? {
          descriptionJson: input.descriptionJson,
          // searchVector (Postgres generated column) reads this, not
          // descriptionJson directly — kept in lockstep with every write.
          descriptionText:
            input.descriptionJson === null ? null : extractPlainText(input.descriptionJson),
        }
      : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.isMilestone !== undefined ? { isMilestone: input.isMilestone } : {}),
  };
}

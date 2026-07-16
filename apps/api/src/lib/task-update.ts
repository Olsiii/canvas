/**
 * Builds the Drizzle `.set()` fields for a task update. Each field is
 * independently optional — a caller changing only `orderKey` (e.g. a
 * same-column drag reorder) must not silently drop that change just because
 * `statusId` didn't also change, and vice versa.
 */
export function buildTaskUpdateFields(input: {
  title?: string;
  statusId?: string;
  orderKey?: string;
}) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
    ...(input.orderKey !== undefined ? { orderKey: input.orderKey } : {}),
  };
}

import { STATUS_KINDS, type StatusKind } from "@canvas/shared";

/** Widget: task_counts. Buckets non-deleted tasks by their current status kind. */
export function countByStatusKind(tasks: { statusKind: StatusKind }[]): Record<StatusKind, number> {
  const counts = Object.fromEntries(STATUS_KINDS.map((k) => [k, 0])) as Record<StatusKind, number>;
  for (const task of tasks) counts[task.statusKind] += 1;
  return counts;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The last `days` calendar-day keys ending on (and including) `today`, oldest first. */
function dayRange(days: number, today: Date): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(dateKey(d));
  }
  return keys;
}

/**
 * Widgets: time_tracked, ai_usage_cost. Sums `value` per calendar day over
 * the trailing `days`-day window ending on `today`, zero-filling days with
 * no rows so the chart's x-axis has no gaps.
 */
export function bucketSumByDay(
  rows: { date: Date; value: number }[],
  days: number,
  today: Date,
): { date: string; value: number }[] {
  const sums = new Map<string, number>();
  for (const row of rows) {
    const key = dateKey(row.date);
    sums.set(key, (sums.get(key) ?? 0) + row.value);
  }
  return dayRange(days, today).map((date) => ({ date, value: sums.get(date) ?? 0 }));
}

/**
 * Widget: burndown. For each of the trailing `days` days, counts tasks that
 * existed and were still incomplete as of the *end* of that day — created
 * on or before it, and either never completed or completed after it.
 */
export function computeBurndownSeries(
  tasks: { createdAt: Date; completedAt: Date | null }[],
  days: number,
  today: Date,
): { date: string; remaining: number }[] {
  return dayRange(days, today).map((date) => {
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    const remaining = tasks.filter(
      (t) => t.createdAt <= endOfDay && (t.completedAt === null || t.completedAt > endOfDay),
    ).length;
    return { date, remaining };
  });
}

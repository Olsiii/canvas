/** Workload view pure helpers (M3.8). */
import { taskDateKey } from "./calendar";

export interface WorkloadAssignment {
  id: string;
  title: string;
  dueDate: string | null;
  startDate: string | null;
  userId: string;
}

/** The tasks assigned to `userId` that land on `date` (Calendar's due→start fallback). */
export function tasksForUserOnDate(
  assignments: WorkloadAssignment[],
  userId: string,
  date: string,
): WorkloadAssignment[] {
  return assignments.filter((a) => a.userId === userId && taskDateKey(a) === date);
}

/** How many dated-and-assigned tasks `userId` has across the whole set (a week's worth, typically). */
export function weeklyTaskCountForUser(assignments: WorkloadAssignment[], userId: string): number {
  return assignments.filter((a) => a.userId === userId).length;
}

export interface OpenTaskCount {
  userId: string;
  count: number;
}

export interface DiversifySuggestion {
  overloadedUserIds: string[];
  underloadedUserIds: string[];
  maxCount: number;
  minCount: number;
}

/**
 * Flags a workload imbalance worth surfacing to the Operations Manager:
 * someone with meaningfully more open tasks than someone else on the same
 * team. Deliberately conservative so a small team's ordinary day-to-day
 * variance (e.g. 3 tasks vs 1) doesn't nag every time — the gap needs to be
 * both large in absolute terms (>= 3) and roughly double in relative terms
 * (or the underloaded side has zero, where any ratio is moot).
 */
export function suggestDiversify(counts: OpenTaskCount[]): DiversifySuggestion | null {
  if (counts.length < 2) return null;
  const max = Math.max(...counts.map((c) => c.count));
  const min = Math.min(...counts.map((c) => c.count));
  const gap = max - min;
  const meaningfullyImbalanced = gap >= 3 && (min === 0 || max >= min * 2);
  if (!meaningfullyImbalanced) return null;

  return {
    overloadedUserIds: counts.filter((c) => c.count === max).map((c) => c.userId),
    underloadedUserIds: counts.filter((c) => c.count === min).map((c) => c.userId),
    maxCount: max,
    minCount: min,
  };
}

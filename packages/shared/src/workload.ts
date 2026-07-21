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

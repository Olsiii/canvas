/** Sunday-start week navigation — shared by Timesheet (M3.7) and Workload (M3.8). */
import { parseDateOnly, toDateOnly } from "./calendar";
import { addDaysToDateOnly } from "./gantt";

export function todayDateOnly(): string {
  const now = new Date();
  return toDateOnly(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Sunday of the week containing `dateOnly` — matches Calendar's (M3.1) Sunday-start grid. */
export function startOfWeekSunday(dateOnly: string): string {
  const { year, monthIndex, day } = parseDateOnly(dateOnly);
  const weekday = new Date(year, monthIndex, day).getDay();
  return addDaysToDateOnly(dateOnly, -weekday);
}

/** The 7 date-only strings (Sun–Sat) of the week starting at `weekStart`. */
export function buildWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(weekStart, i));
}

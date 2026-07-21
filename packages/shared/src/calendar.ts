/** Calendar month helpers — date-only strings (YYYY-MM-DD), no timezones. */

export type CalendarDayCell = {
  /** YYYY-MM-DD */
  date: string;
  day: number;
  inMonth: boolean;
};

export function toDateOnly(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function parseDateOnly(value: string): { year: number; monthIndex: number; day: number } {
  const [y, m, d] = value.split("-").map((part) => Number(part));
  if (!y || !m || !d) throw new Error(`Invalid date-only string: ${value}`);
  return { year: y, monthIndex: m - 1, day: d };
}

/**
 * 6×7 month grid starting on Sunday. Includes leading/trailing days from
 * adjacent months so the grid is always rectangular.
 */
export function buildMonthGrid(year: number, monthIndex: number): CalendarDayCell[] {
  const first = new Date(year, monthIndex, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();

  const cells: CalendarDayCell[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
    const prevYear = monthIndex === 0 ? year - 1 : year;
    cells.push({ date: toDateOnly(prevYear, prevMonth, day), day, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: toDateOnly(year, monthIndex, day), day, inMonth: true });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
    const nextYear = monthIndex === 11 ? year + 1 : year;
    cells.push({
      date: toDateOnly(nextYear, nextMonth, nextDay),
      day: nextDay,
      inMonth: false,
    });
    nextDay += 1;
    if (cells.length >= 42) break;
  }

  return cells;
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Which date a task is placed on in a date-keyed view (Calendar, M3.1;
 * Workload, M3.8): due date, falling back to start date, or unplaced if
 * neither is set. Extracted here (was local to TaskCalendarView) once
 * Workload needed the identical fallback rule.
 */
export function taskDateKey(task: {
  dueDate: string | null;
  startDate: string | null;
}): string | null {
  return task.dueDate ?? task.startDate ?? null;
}

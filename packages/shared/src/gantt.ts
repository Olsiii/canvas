/** Gantt/timeline pure date math (M3.3) — date-only strings (YYYY-MM-DD), no timezones. */
import { parseDateOnly, toDateOnly } from "./calendar";

export type DateOnly = string;

export function addDaysToDateOnly(date: DateOnly, days: number): DateOnly {
  const { year, monthIndex, day } = parseDateOnly(date);
  const shifted = new Date(year, monthIndex, day + days);
  return toDateOnly(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}

export function daysBetweenDateOnly(from: DateOnly, to: DateOnly): number {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (Date.UTC(b.year, b.monthIndex, b.day) - Date.UTC(a.year, a.monthIndex, a.day)) / msPerDay,
  );
}

export type GanttSpan = { start: DateOnly; end: DateOnly };

/**
 * A task's bar span. Falls back to whichever of start/due is present when
 * only one is set (a single-day bar); a task with neither is excluded from
 * the Gantt (rendered in an "undated" strip instead, same as Calendar).
 */
export function taskDateSpan(task: {
  startDate: DateOnly | null;
  dueDate: DateOnly | null;
}): GanttSpan | null {
  const start = task.startDate ?? task.dueDate;
  const end = task.dueDate ?? task.startDate;
  if (!start || !end) return null;
  return daysBetweenDateOnly(start, end) < 0 ? { start: end, end: start } : { start, end };
}

export type GanttDayCell = {
  date: DateOnly;
  day: number;
  isWeekend: boolean;
  isMonthStart: boolean;
};

/**
 * The visible date range: tightest span covering every task's bar, padded
 * by `paddingDays` on each side. Falls back to a two-week window around
 * `today` when nothing has dates yet (mirrors Calendar's month default).
 */
export function buildGanttRange(spans: GanttSpan[], today: DateOnly, paddingDays = 2): GanttSpan {
  if (spans.length === 0) {
    return { start: addDaysToDateOnly(today, -paddingDays), end: addDaysToDateOnly(today, 13) };
  }
  // Date-only strings (YYYY-MM-DD) sort correctly with plain string
  // comparison, so min/max don't need day-diff math.
  let start = spans[0]!.start;
  let end = spans[0]!.end;
  for (const span of spans) {
    if (span.start < start) start = span.start;
    if (span.end > end) end = span.end;
  }
  return {
    start: addDaysToDateOnly(start, -paddingDays),
    end: addDaysToDateOnly(end, paddingDays),
  };
}

export function buildGanttDays(range: GanttSpan): GanttDayCell[] {
  const total = daysBetweenDateOnly(range.start, range.end) + 1;
  const cells: GanttDayCell[] = [];
  for (let i = 0; i < total; i++) {
    const date = addDaysToDateOnly(range.start, i);
    const { day } = parseDateOnly(date);
    const weekday = new Date(date + "T00:00:00").getDay();
    cells.push({ date, day, isWeekend: weekday === 0 || weekday === 6, isMonthStart: day === 1 });
  }
  return cells;
}

/** 0-based offset (in days) of a span's start/end within `range`, for bar positioning. */
export function ganttBarOffset(span: GanttSpan, range: GanttSpan): { left: number; width: number } {
  const left = daysBetweenDateOnly(range.start, span.start);
  const width = daysBetweenDateOnly(span.start, span.end) + 1;
  return { left, width };
}

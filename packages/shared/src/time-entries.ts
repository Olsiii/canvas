/** Time tracking / timesheet pure helpers (M3.7). */

export interface TimesheetEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  startedAt: string; // ISO timestamp
  endedAt: string | null;
  durationSec: number | null;
}

export interface TimesheetDay {
  /** YYYY-MM-DD, the local calendar date startedAt falls on. */
  date: string;
  totalSec: number;
  entries: TimesheetEntry[];
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Groups entries by the local calendar day their startedAt falls on, each
 * day's total the sum of its entries' durationSec (a still-running entry —
 * durationSec null — contributes 0, not NaN). Days are sorted descending
 * (most recent first, the natural timesheet reading order); entries within
 * a day are sorted by startedAt ascending.
 */
export function groupTimeEntriesByDay(entries: TimesheetEntry[]): TimesheetDay[] {
  const byDate = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    const key = localDateKey(entry.startedAt);
    const list = byDate.get(key) ?? [];
    list.push(entry);
    byDate.set(key, list);
  }

  return Array.from(byDate.entries())
    .map(([date, dayEntries]) => ({
      date,
      totalSec: sumDurations(dayEntries),
      entries: [...dayEntries].sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function sumDurations(entries: { durationSec: number | null }[]): number {
  return entries.reduce((sum, e) => sum + (e.durationSec ?? 0), 0);
}

/** "1h 23m", "45m", "30s" — drops leading zero units, never shows "0h 5m". */
export function formatDurationSec(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

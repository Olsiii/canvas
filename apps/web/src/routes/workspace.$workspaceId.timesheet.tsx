import {
  addDaysToDateOnly,
  formatDurationSec,
  groupTimeEntriesByDay,
  startOfWeekSunday,
  sumDurations,
  todayDateOnly,
} from "@canvas/shared";
import { trpc } from "@/lib/trpc";
import { createRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const timesheetRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/timesheet",
  component: TimesheetPage,
});

function TimesheetPage() {
  const { workspaceId } = timesheetRoute.useParams();
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(todayDateOnly()));
  const weekEnd = addDaysToDateOnly(weekStart, 6);

  const entries = trpc.timeEntry.timesheet.useQuery({
    workspaceId,
    start: weekStart,
    end: weekEnd,
  });
  const data = useMemo(() => entries.data ?? [], [entries.data]);
  const days = useMemo(() => groupTimeEntriesByDay(data), [data]);
  const totalSec = useMemo(() => sumDurations(data), [data]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Timesheet</h1>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            data-testid="timesheet-prev-week"
            onClick={() => setWeekStart((w) => addDaysToDateOnly(w, -7))}
            className="border-border hover:bg-muted rounded border px-2 py-1 text-xs"
          >
            Prev
          </button>
          <span className="text-muted-foreground text-xs">
            {weekStart} – {weekEnd}
          </span>
          <button
            type="button"
            data-testid="timesheet-next-week"
            onClick={() => setWeekStart((w) => addDaysToDateOnly(w, 7))}
            className="border-border hover:bg-muted rounded border px-2 py-1 text-xs"
          >
            Next
          </button>
        </div>
      </div>

      <p className="text-sm font-medium" data-testid="timesheet-total">
        Total: {formatDurationSec(totalSec)}
      </p>

      {entries.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : days.length === 0 ? (
        <p className="text-muted-foreground text-sm">No time logged this week.</p>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <div key={day.date} data-testid={`timesheet-day-${day.date}`} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{day.date}</p>
                <p
                  className="text-muted-foreground text-xs"
                  data-testid={`timesheet-day-total-${day.date}`}
                >
                  {formatDurationSec(day.totalSec)}
                </p>
              </div>
              <ul className="divide-border divide-y rounded-md border">
                {day.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between p-2 text-sm">
                    <span className="truncate">{entry.taskTitle}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {entry.durationSec != null
                        ? formatDurationSec(entry.durationSec)
                        : "running…"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

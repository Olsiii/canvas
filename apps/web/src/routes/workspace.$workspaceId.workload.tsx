import {
  addDaysToDateOnly,
  startOfWeekSunday,
  tasksForUserOnDate,
  todayDateOnly,
  weeklyTaskCountForUser,
  WEEKDAY_LABELS,
} from "@canvas/shared";
import { TaskDetailPanel } from "@/components/task-detail-panel";
import { trpc } from "@/lib/trpc";
import { createRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const workloadRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/workload",
  component: WorkloadPage,
});

function WorkloadPage() {
  const { workspaceId } = workloadRoute.useParams();
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(todayDateOnly()));
  const weekEnd = addDaysToDateOnly(weekStart, 6);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(weekStart, i)),
    [weekStart],
  );

  const members = trpc.workspace.members.useQuery({ workspaceId });
  const assignments = trpc.workload.assignments.useQuery({
    workspaceId,
    start: weekStart,
    end: weekEnd,
  });
  const data = useMemo(() => assignments.data ?? [], [assignments.data]);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Workload</h1>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            data-testid="workload-prev-week"
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
            data-testid="workload-next-week"
            onClick={() => setWeekStart((w) => addDaysToDateOnly(w, 7))}
            className="border-border hover:bg-muted rounded border px-2 py-1 text-xs"
          >
            Next
          </button>
        </div>
      </div>

      {members.isLoading || assignments.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (members.data ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No members yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid gap-px overflow-hidden rounded-md border bg-border text-xs"
            style={{ gridTemplateColumns: `160px repeat(7, minmax(120px, 1fr))` }}
          >
            <div className="bg-muted p-2 font-medium">Member</div>
            {days.map((date, i) => (
              <div key={date} className="bg-muted p-2 font-medium">
                {WEEKDAY_LABELS[i]} <span className="text-muted-foreground">{date.slice(5)}</span>
              </div>
            ))}

            {(members.data ?? []).map((member) => (
              <div
                key={member.userId}
                className="contents"
                data-testid={`workload-row-${member.userId}`}
              >
                <div className="bg-background flex items-center justify-between gap-2 p-2">
                  <span className="truncate font-medium">{member.name}</span>
                  <span
                    className="text-muted-foreground shrink-0"
                    data-testid={`workload-total-${member.userId}`}
                  >
                    {weeklyTaskCountForUser(data, member.userId)}
                  </span>
                </div>
                {days.map((date) => {
                  const tasks = tasksForUserOnDate(data, member.userId, date);
                  return (
                    <div
                      key={date}
                      data-testid={`workload-cell-${member.userId}-${date}`}
                      className="bg-background space-y-0.5 p-1"
                    >
                      {tasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setOpenTaskId(task.id)}
                          className="bg-muted hover:bg-muted/80 block w-full truncate rounded px-1 py-0.5 text-left"
                        >
                          {task.title}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {openTaskId && (
        <TaskDetailPanel
          taskId={openTaskId}
          workspaceId={workspaceId}
          onClose={() => setOpenTaskId(null)}
          onOpenTask={setOpenTaskId}
        />
      )}
    </div>
  );
}

import type { AppRouter } from "@canvas/api";
import { useOptimisticTaskUpdate } from "@/hooks/use-task-mutations";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Status = RouterOutputs["status"]["list"][number];
type Task = RouterOutputs["task"]["list"][number];

/**
 * The status picker used by both List and Table views (previously two
 * near-identical bare `<select>`s, one per file). Shows the status's own
 * color as a small dot inside the control instead of a plain unstyled
 * dropdown — the only place `statuses.color` was rendered before this was
 * the Board column header and List's grouped-row header, never the actual
 * per-task picker in either view.
 */
export function StatusSelect({
  listId,
  task,
  statuses,
  testId,
}: {
  listId: string;
  task: Task;
  statuses: Status[];
  testId?: string;
}) {
  const update = useOptimisticTaskUpdate(listId);
  const current = statuses.find((s) => s.id === task.statusId);

  return (
    <div className="relative inline-flex w-full items-center">
      <span
        className="pointer-events-none absolute left-2 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: current?.color }}
        aria-hidden
      />
      <select
        data-testid={testId}
        value={task.statusId}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ taskId: task.id, statusId: e.target.value })}
        className="border-border bg-background h-7 w-full rounded border py-0 pr-2 pl-5 text-xs font-medium"
      >
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

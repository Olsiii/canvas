import { formatDurationSec } from "@canvas/shared";
import { trpc } from "@/lib/trpc";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * A persistent "timer's running" indicator in the workspace shell header —
 * visible regardless of which list/task the caller is currently viewing,
 * since a running timer isn't scoped to the current page (M3.7). Links back
 * to the task via the same `?openTask=` search param NotificationsBell
 * already uses to deep-link into a task's detail panel.
 */
export function RunningTimerWidget() {
  const utils = trpc.useUtils();
  const running = trpc.timeEntry.myRunning.useQuery(undefined, { refetchInterval: 30_000 });
  const stop = trpc.timeEntry.stop.useMutation({
    onSuccess: () => void utils.timeEntry.myRunning.invalidate(),
  });

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!running.data) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running.data]);

  if (!running.data) return null;

  const elapsedSec = Math.max(
    0,
    Math.round((Date.now() - new Date(running.data.startedAt).getTime()) / 1000),
  );

  return (
    <div className="border-border bg-muted/40 flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
      <Link
        to="/w/$workspaceId/l/$listId"
        params={{ workspaceId: running.data.workspaceId, listId: running.data.listId }}
        search={{ openTask: running.data.taskId }}
        className="hover:underline"
      >
        ⏱ {formatDurationSec(elapsedSec)} · {running.data.taskTitle}
      </Link>
      <button
        type="button"
        aria-label="Stop timer"
        title="Stop timer"
        disabled={stop.isPending}
        onClick={() => stop.mutate()}
        className="text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        Stop
      </button>
    </div>
  );
}

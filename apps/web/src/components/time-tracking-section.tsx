import type { AppRouter } from "@canvas/api";
import { formatDurationSec, sumDurations } from "@canvas/shared";
import { Section } from "@/components/detail-field";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type TimeEntry = RouterOutputs["timeEntry"]["listForTask"][number];

function liveElapsedSec(startedAt: string | Date): number {
  return Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
}

export function TimeTrackingSection({ taskId }: { taskId: string }) {
  const { user } = useSession();
  const utils = trpc.useUtils();
  const entries = trpc.timeEntry.listForTask.useQuery({ taskId });
  const running = trpc.timeEntry.myRunning.useQuery();

  const invalidate = () => {
    void utils.timeEntry.listForTask.invalidate({ taskId });
    void utils.timeEntry.myRunning.invalidate();
  };
  const start = trpc.timeEntry.start.useMutation({ onSuccess: invalidate });
  const stop = trpc.timeEntry.stop.useMutation({ onSuccess: invalidate });
  const remove = trpc.timeEntry.delete.useMutation({ onSuccess: invalidate });

  const [logging, setLogging] = useState(false);
  const [startedAtInput, setStartedAtInput] = useState("");
  const [endedAtInput, setEndedAtInput] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createManual = trpc.timeEntry.createManual.useMutation({
    onSuccess: () => {
      invalidate();
      setLogging(false);
      setStartedAtInput("");
      setEndedAtInput("");
      setNote("");
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const isRunningHere = running.data?.taskId === taskId;

  // Forces a re-render once a second so the "Stop timer (mm:ss)" label
  // ticks live — only while this task's timer is actually running.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!isRunningHere) return;
    const id = setInterval(() => forceTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRunningHere]);

  const totalSec = sumDurations(entries.data ?? []);

  return (
    <Section label="Time tracked">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          {isRunningHere ? (
            <button
              type="button"
              data-testid="stop-timer"
              disabled={stop.isPending}
              onClick={() => stop.mutate()}
              className="bg-primary text-primary-foreground h-7 rounded px-2 text-xs disabled:opacity-50"
            >
              Stop timer ({formatDurationSec(liveElapsedSec(running.data!.startedAt))})
            </button>
          ) : (
            <button
              type="button"
              data-testid="start-timer"
              disabled={start.isPending}
              onClick={() => start.mutate({ taskId })}
              className="border-border hover:bg-muted h-7 rounded border px-2 text-xs disabled:opacity-50"
            >
              Start timer
            </button>
          )}
          <span className="text-muted-foreground text-xs" data-testid="time-tracked-total">
            {formatDurationSec(totalSec)} total
          </span>
        </div>

        <div className="space-y-1">
          {(entries.data ?? []).map((entry: TimeEntry) => (
            <div
              key={entry.id}
              data-testid={`time-entry-${entry.id}`}
              className="group border-border flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
            >
              <span className="shrink-0 truncate text-xs font-medium">{entry.userName}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {entry.durationSec != null ? formatDurationSec(entry.durationSec) : "running…"}
              </span>
              {entry.note && (
                <span className="text-muted-foreground flex-1 truncate">{entry.note}</span>
              )}
              {entry.userId === user?.id && (
                <button
                  type="button"
                  aria-label={`Delete time entry (${entry.durationSec != null ? formatDurationSec(entry.durationSec) : "running"})`}
                  title={`Delete time entry (${entry.durationSec != null ? formatDurationSec(entry.durationSec) : "running"})`}
                  onClick={() => remove.mutate({ entryId: entry.id })}
                  className="text-muted-foreground hover:text-foreground ml-auto hidden shrink-0 group-hover:inline"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {logging ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              if (!startedAtInput || !endedAtInput) return;
              createManual.mutate({
                taskId,
                startedAt: startedAtInput,
                endedAt: endedAtInput,
                note: note.trim() || undefined,
              });
            }}
          >
            <Input
              type="datetime-local"
              aria-label="Start time"
              value={startedAtInput}
              onChange={(e) => setStartedAtInput(e.target.value)}
              className="h-7 w-auto text-xs"
            />
            <Input
              type="datetime-local"
              aria-label="End time"
              value={endedAtInput}
              onChange={(e) => setEndedAtInput(e.target.value)}
              className="h-7 w-auto text-xs"
            />
            <Input
              value={note}
              placeholder="Note (optional)"
              aria-label="Time entry note"
              onChange={(e) => setNote(e.target.value)}
              className="h-7 text-xs"
            />
            <button
              type="submit"
              disabled={!startedAtInput || !endedAtInput || createManual.isPending}
              className="bg-primary text-primary-foreground h-7 rounded px-2 text-xs disabled:opacity-50"
            >
              Log
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setLogging(true)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            + Log time manually
          </button>
        )}
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    </Section>
  );
}

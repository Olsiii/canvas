import type { AppRouter } from "@canvas/api";
import { Section } from "@/components/detail-field";
import { formatRelativeTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ActivityEntry = RouterOutputs["activity"]["list"][number];

const VERB_LABEL: Record<string, string> = {
  "task.created": "created this task",
  "task.updated": "updated this task",
  "task.assigned": "assigned someone",
  "task.unassigned": "unassigned someone",
  "task.deleted": "deleted this task",
};

function describe(entry: ActivityEntry): string {
  return VERB_LABEL[entry.verb] ?? entry.verb;
}

export function ActivitySection({ taskId }: { taskId: string }) {
  const activity = trpc.activity.list.useQuery({ taskId });
  const entries = activity.data ?? [];

  if (entries.length === 0) return null;

  return (
    <Section label="Activity">
      <ul className="space-y-1">
        {entries.map((entry) => (
          <li key={entry.id} className="text-muted-foreground text-xs">
            <span className="text-foreground font-medium">{entry.actorName}</span>{" "}
            {describe(entry)} · {formatRelativeTime(new Date(entry.createdAt))}
          </li>
        ))}
      </ul>
    </Section>
  );
}

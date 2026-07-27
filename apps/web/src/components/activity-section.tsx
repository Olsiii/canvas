import type { AppRouter } from "@canvas/api";
import { Section } from "@/components/detail-field";
import { formatRelativeTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ActivityEntry = RouterOutputs["activity"]["list"][number];

const VERB_LABEL: Record<string, string> = {
  "task.created": "created this task",
  "task.created_from_form": "created this task from a form submission",
  "task.created_from_template": "created this task from a template",
  "task.created_from_import": "created this task via import",
  "task.updated": "updated this task",
  "task.assigned": "assigned someone",
  "task.unassigned": "unassigned someone",
  "task.priority_urgent": "flagged this task as urgent",
  "task.tagged": "added a tag",
  "task.untagged": "removed a tag",
  "task.dependency_added": "added a dependency",
  "task.dependency_removed": "removed a dependency",
  "task.recurrence_set": "set this task to repeat",
  "task.recurrence_cleared": "turned off repeating",
  "task.pr_linked": "linked a pull request",
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
            <span className="text-foreground font-medium">{entry.actorName}</span> {describe(entry)}{" "}
            · {formatRelativeTime(new Date(entry.createdAt))}
          </li>
        ))}
      </ul>
    </Section>
  );
}

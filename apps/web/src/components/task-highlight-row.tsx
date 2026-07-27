import type { AppRouter } from "@canvas/api";
import { Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type HighlightTask = RouterOutputs["task"]["highlights"]["priority"][number];

const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-status-critical/15 text-status-critical",
  high: "bg-status-serious/15 text-status-serious",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted text-muted-foreground",
};

export function TaskHighlightRow({
  task,
  workspaceId,
  memberNamesById,
  onNavigate,
}: {
  task: HighlightTask;
  workspaceId: string;
  memberNamesById: Map<string, string>;
  /** Fires when the row is clicked, in addition to the link navigation —
   * lets an overlay (e.g. LoginSummaryPanel) close itself on click-through. */
  onNavigate?: () => void;
}) {
  const assigneeNames = task.assigneeIds.map((id) => memberNamesById.get(id) ?? "Someone");

  return (
    <Link
      to="/w/$workspaceId/l/$listId"
      params={{ workspaceId, listId: task.listId }}
      search={{ openTask: task.id }}
      onClick={onNavigate}
      data-testid={`task-highlight-${task.id}`}
      // An explicit label, rather than the row's full nested text (title +
      // assignees + space/list breadcrumb), keeps this link's accessible
      // name from accidentally substring-matching an unrelated same-named
      // list/space link elsewhere on the page in `getByRole("link", {name})`
      // lookups — the breadcrumb text is still visible, just not part of
      // the accessible name.
      aria-label={`Open ${task.title}`}
      className="border-border hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors"
    >
      {task.priority && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${PRIORITY_TONE[task.priority] ?? PRIORITY_TONE.normal}`}
        >
          {task.priority}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
      {assigneeNames.length > 0 && (
        <span className="text-muted-foreground shrink-0 truncate text-xs">
          {assigneeNames.join(", ")}
        </span>
      )}
      <span className="text-muted-foreground shrink-0 truncate text-xs">
        {task.spaceName} / {task.listName}
      </span>
    </Link>
  );
}

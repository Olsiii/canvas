import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useState, type FormEvent } from "react";

// Mirrors doc-task-links.tsx (M4.2) — same linking UI, wired to
// goal.links.* instead of doc.links.*. Kept as its own component rather
// than a shared abstraction: the two call different routers with
// different field names, and this is only the second occurrence.
export function GoalTaskLinks({ goalId, workspaceId }: { goalId: string; workspaceId: string }) {
  const utils = trpc.useUtils();
  const links = trpc.goal.links.list.useQuery({ goalId });
  const [query, setQuery] = useState("");
  const search = trpc.task.search.useQuery(
    { workspaceId, query },
    { enabled: query.trim().length >= 2 },
  );
  const add = trpc.goal.links.add.useMutation({
    onSuccess: () => {
      void utils.goal.links.list.invalidate({ goalId });
      void utils.goal.get.invalidate({ goalId });
      setQuery("");
    },
  });
  const remove = trpc.goal.links.remove.useMutation({
    onSuccess: () => {
      void utils.goal.links.list.invalidate({ goalId });
      void utils.goal.get.invalidate({ goalId });
    },
  });

  function handleSearch(e: FormEvent) {
    e.preventDefault();
  }

  return (
    <div className="space-y-2" data-testid="goal-task-links">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Linked tasks
      </h2>
      {(links.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-xs">No tasks linked yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {links.data?.map((link) => (
            <li
              key={link.taskId}
              // Deliberately not prefixed "goal-task-link-" — that prefix is
              // shared by the search box and its result buttons below, and a
              // test locator like `[data-testid^='goal-task-link-']` would
              // silently match those too.
              data-testid={`goal-linked-task-${link.taskId}`}
              className="border-border bg-muted/40 flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
            >
              <span className={link.completedAt ? "line-through" : undefined}>
                {link.taskTitle}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Unlink ${link.taskTitle}`}
                title={`Unlink ${link.taskTitle}`}
                onClick={() => remove.mutate({ goalId, taskId: link.taskId })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSearch} className="flex max-w-md gap-2">
        <Input
          data-testid="goal-task-link-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks to link…"
          className="h-8 text-sm"
        />
      </form>
      {query.trim().length >= 2 && (search.data?.length ?? 0) > 0 && (
        <ul className="border-border max-w-md divide-y rounded-md border text-sm">
          {search.data?.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                data-testid={`goal-task-link-result-${task.id}`}
                className="hover:bg-muted flex w-full items-center justify-between px-3 py-2 text-left"
                onClick={() => add.mutate({ goalId, taskId: task.id })}
                disabled={add.isPending}
              >
                <span>{task.title}</span>
                <span className="text-muted-foreground text-xs">
                  {task.spaceName} / {task.listName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

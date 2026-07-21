import { trpc } from "@/lib/trpc";

/**
 * M3.6: browse/delete workspace task templates. Creation happens from a
 * task's detail panel ("Save as template") — there's no blank-template
 * creation flow here, matching how a template only makes sense as a
 * snapshot of a real task.
 */
export function TemplatesPanel({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const templates = trpc.taskTemplate.list.useQuery({ workspaceId });
  const remove = trpc.taskTemplate.delete.useMutation({
    onSuccess: () => utils.taskTemplate.list.invalidate({ workspaceId }),
  });

  const entries = templates.data ?? [];

  return (
    <div className="w-full max-w-md space-y-2 p-6">
      <h2 className="text-sm font-medium">Task templates</h2>
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No templates yet — save a task as a template to see it here.
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-md border">
          {entries.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 p-2 text-sm">
              <span className="truncate font-medium">{t.name}</span>
              <button
                type="button"
                aria-label={`Delete template ${t.name}`}
                onClick={() => remove.mutate({ templateId: t.id })}
                className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

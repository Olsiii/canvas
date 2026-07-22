import {
  AutomationActionsEditor,
  newActionDraft,
  toAutomationActions,
  type ActionDraft,
} from "@/components/automation-actions-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { STATUS_KINDS, TASK_PRIORITIES, type StatusKind, type TaskPriority } from "@canvas/shared";
import { createRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const automationsListRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/automations",
  component: AutomationsListPage,
});

function AutomationsListPage() {
  const { workspaceId } = automationsListRoute.useParams();
  const utils = trpc.useUtils();
  const automations = trpc.automation.list.useQuery({ workspaceId });
  const tags = trpc.tag.list.useQuery({ workspaceId });

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<"task_created" | "task_status_changed">(
    "task_status_changed",
  );
  const [toStatusKind, setToStatusKind] = useState<StatusKind>("done");
  const [conditionEnabled, setConditionEnabled] = useState(false);
  const [conditionPriority, setConditionPriority] = useState<TaskPriority>("normal");
  const [actions, setActions] = useState<ActionDraft[]>([newActionDraft()]);

  const create = trpc.automation.create.useMutation({
    onSuccess: () => {
      void utils.automation.list.invalidate({ workspaceId });
      setCreating(false);
      setName("");
      setActions([newActionDraft()]);
      setConditionEnabled(false);
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate({
      workspaceId,
      name: name.trim() || "Untitled automation",
      trigger:
        triggerType === "task_created"
          ? { type: "task_created" }
          : { type: "task_status_changed", toStatusKind },
      conditions: conditionEnabled ? [{ field: "priority", equals: conditionPriority }] : [],
      actions: toAutomationActions(actions),
    });
  }

  return (
    <div className="space-y-4 p-6" data-testid="automations-list-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Automations</h1>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)} data-testid="automations-new">
            New automation
          </Button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="border-border max-w-2xl space-y-3 rounded-md border p-4"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Automation name"
            className="h-8 text-sm"
            data-testid="automations-new-name"
          />

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">When</span>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as typeof triggerType)}
              className="border-border bg-background h-8 rounded border text-sm"
              data-testid="automations-trigger-type"
            >
              <option value="task_created">a task is created</option>
              <option value="task_status_changed">a task's status changes to…</option>
            </select>
            {triggerType === "task_status_changed" && (
              <select
                value={toStatusKind}
                onChange={(e) => setToStatusKind(e.target.value as StatusKind)}
                className="border-border bg-background h-8 rounded border text-sm"
                data-testid="automations-trigger-status-kind"
              >
                {STATUS_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.charAt(0).toUpperCase() + kind.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={conditionEnabled}
                onChange={(e) => setConditionEnabled(e.target.checked)}
                data-testid="automations-condition-enabled"
              />
              Only if priority equals
            </label>
            {conditionEnabled && (
              <select
                value={conditionPriority}
                onChange={(e) => setConditionPriority(e.target.value as TaskPriority)}
                className="border-border bg-background h-8 rounded border text-sm"
                data-testid="automations-condition-priority"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <span className="text-muted-foreground mb-1 block text-xs font-medium">Then</span>
            <AutomationActionsEditor
              actions={actions}
              onChange={setActions}
              tags={tags.data ?? []}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={create.isPending}
              data-testid="automations-create-submit"
            >
              {create.isPending ? "Creating…" : "Create automation"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
          {create.error && <p className="text-xs text-red-500">{create.error.message}</p>}
        </form>
      )}

      {automations.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (automations.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-sm">
          No automations yet. Create one to run actions automatically when tasks change.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {automations.data?.map((automation) => (
            <li key={automation.id}>
              <Link
                to="/w/$workspaceId/automations/$automationId"
                params={{ workspaceId, automationId: automation.id }}
                data-testid={`automations-link-${automation.id}`}
                className="hover:bg-muted flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="font-medium">{automation.name}</span>
                <span className="text-muted-foreground text-xs">
                  {automation.enabled ? "Enabled" : "Disabled"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

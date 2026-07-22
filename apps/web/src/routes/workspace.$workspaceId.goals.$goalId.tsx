import { GoalProgressBar } from "@/components/goal-progress-bar";
import { GoalTaskLinks } from "@/components/goal-task-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { goalMetricSchema } from "@canvas/shared";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const goalEditorRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/goals/$goalId",
  component: GoalEditorPage,
});

function GoalEditorPage() {
  const { workspaceId, goalId } = goalEditorRoute.useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const goal = trpc.goal.get.useQuery({ goalId });

  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [metricType, setMetricType] = useState<"task_completion" | "numeric">("task_completion");
  const [target, setTarget] = useState(100);
  const [current, setCurrent] = useState(0);
  const [unit, setUnit] = useState("");

  useEffect(() => {
    if (!goal.data) return;
    setName(goal.data.name);
    setDueDate(goal.data.dueDate ?? "");
    const metric = goalMetricSchema.parse(goal.data.metricJson);
    if (metric.type === "numeric") {
      setMetricType("numeric");
      setTarget(metric.target);
      setCurrent(metric.current);
      setUnit(metric.unit ?? "");
    } else {
      setMetricType("task_completion");
    }
  }, [goal.data]);

  const update = trpc.goal.update.useMutation({
    onSuccess: () => void utils.goal.get.invalidate({ goalId }),
  });
  const remove = trpc.goal.delete.useMutation({
    onSuccess: () => {
      void utils.goal.list.invalidate({ workspaceId });
      void navigate({ to: "/w/$workspaceId/goals", params: { workspaceId } });
    },
  });

  function handleSave(e: FormEvent) {
    e.preventDefault();
    update.mutate({
      goalId,
      name: name.trim() || "Untitled goal",
      dueDate: dueDate || null,
      metric:
        metricType === "task_completion"
          ? { type: "task_completion" }
          : { type: "numeric", target, current, unit: unit.trim() || undefined },
    });
  }

  if (goal.isLoading || !goal.data) {
    return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;
  }

  return (
    <div className="max-w-lg space-y-4 p-6" data-testid="goal-editor-page">
      <h1 className="text-lg font-semibold">{goal.data.name}</h1>
      <GoalProgressBar progress={goal.data.progress} />

      <form onSubmit={handleSave} className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Goal name"
          className="h-8 text-sm"
          data-testid="goal-editor-name"
        />

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">Measured by</span>
          <select
            value={metricType}
            onChange={(e) => setMetricType(e.target.value as typeof metricType)}
            className="border-border bg-background h-8 rounded border text-sm"
          >
            <option value="task_completion">Linked task completion</option>
            <option value="numeric">Numeric target</option>
          </select>
        </div>

        {metricType === "numeric" && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs">
              Current
              <Input
                type="number"
                value={current}
                onChange={(e) => setCurrent(Number(e.target.value))}
                className="h-8 w-24 text-sm"
                data-testid="goal-editor-current"
              />
            </label>
            <label className="flex items-center gap-1 text-xs">
              Target
              <Input
                type="number"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="h-8 w-24 text-sm"
              />
            </label>
            <label className="flex items-center gap-1 text-xs">
              Unit
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-8 w-24 text-sm"
              />
            </label>
          </div>
        )}

        <label className="flex items-center gap-2 text-xs">
          Due date
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-8 w-40 text-sm"
          />
        </label>

        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={update.isPending}
            data-testid="goal-editor-save"
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate({ goalId })}
            data-testid="goal-editor-delete"
          >
            Delete goal
          </Button>
        </div>
        {update.error && <p className="text-xs text-red-500">{update.error.message}</p>}
      </form>

      <GoalTaskLinks goalId={goalId} workspaceId={workspaceId} />
    </div>
  );
}

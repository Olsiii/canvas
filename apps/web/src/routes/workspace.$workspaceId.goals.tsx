import { GoalProgressBar } from "@/components/goal-progress-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { createRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const goalsListRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/goals",
  component: GoalsListPage,
});

function GoalsListPage() {
  const { workspaceId } = goalsListRoute.useParams();
  const utils = trpc.useUtils();
  const goals = trpc.goal.list.useQuery({ workspaceId });

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [metricType, setMetricType] = useState<"task_completion" | "numeric">("task_completion");
  const [target, setTarget] = useState(100);
  const [unit, setUnit] = useState("");

  const create = trpc.goal.create.useMutation({
    onSuccess: () => {
      void utils.goal.list.invalidate({ workspaceId });
      setCreating(false);
      setName("");
      setDueDate("");
      setMetricType("task_completion");
      setTarget(100);
      setUnit("");
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate({
      workspaceId,
      name: name.trim() || "Untitled goal",
      dueDate: dueDate || null,
      metric:
        metricType === "task_completion"
          ? { type: "task_completion" }
          : { type: "numeric", target, current: 0, unit: unit.trim() || undefined },
    });
  }

  return (
    <div className="space-y-4 p-6" data-testid="goals-list-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Goals</h1>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)} data-testid="goals-new">
            New goal
          </Button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="border-border max-w-lg space-y-3 rounded-md border p-4"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Goal name"
            className="h-8 text-sm"
            data-testid="goals-new-name"
          />

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">Measured by</span>
            <select
              value={metricType}
              onChange={(e) => setMetricType(e.target.value as typeof metricType)}
              className="border-border bg-background h-8 rounded border text-sm"
              data-testid="goals-metric-type"
            >
              <option value="task_completion">Linked task completion</option>
              <option value="numeric">Numeric target</option>
            </select>
          </div>

          {metricType === "numeric" && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                Target
                <Input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  className="h-8 w-24 text-sm"
                  data-testid="goals-metric-target"
                />
              </label>
              <label className="flex items-center gap-1 text-xs">
                Unit
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="signups"
                  className="h-8 w-28 text-sm"
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
              disabled={create.isPending}
              data-testid="goals-create-submit"
            >
              {create.isPending ? "Creating…" : "Create goal"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
          {create.error && <p className="text-xs text-red-500">{create.error.message}</p>}
        </form>
      )}

      {goals.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (goals.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-sm">
          No goals yet. Create one and link tasks to track progress.
        </p>
      ) : (
        <ul className="divide-border border-border max-w-lg divide-y rounded-md border">
          {goals.data?.map((goal) => (
            <li key={goal.id}>
              <Link
                to="/w/$workspaceId/goals/$goalId"
                params={{ workspaceId, goalId: goal.id }}
                data-testid={`goals-link-${goal.id}`}
                className="hover:bg-muted block space-y-1 px-3 py-2 text-sm"
              >
                <span className="font-medium">{goal.name}</span>
                <GoalProgressBar progress={goal.progress} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

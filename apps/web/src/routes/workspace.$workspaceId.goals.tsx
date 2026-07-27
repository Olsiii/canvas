import { GoalProgressBar } from "@/components/goal-progress-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { createRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Plus, Target } from "lucide-react";
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
        <div className="flex items-center gap-2">
          <span className="bg-accent-soft text-accent flex h-9 w-9 items-center justify-center rounded-md">
            <Target className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Goals</h1>
            <p className="text-muted-foreground text-xs">
              Track progress toward what the team is working for.
            </p>
          </div>
        </div>
        {!creating && (
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            data-testid="goals-new"
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New goal
          </Button>
        )}
      </div>

      {creating && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>New goal</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
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
          </CardContent>
        </Card>
      )}

      {goals.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (goals.data?.length ?? 0) === 0 ? (
        <Card className="max-w-lg p-6 text-center text-sm text-muted-foreground">
          No goals yet. Create one and link tasks to track progress.
        </Card>
      ) : (
        <Card className="max-w-lg divide-y overflow-hidden p-0">
          {goals.data?.map((goal) => (
            <Link
              key={goal.id}
              to="/w/$workspaceId/goals/$goalId"
              params={{ workspaceId, goalId: goal.id }}
              data-testid={`goals-link-${goal.id}`}
              className="hover:bg-muted flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <span className="font-medium">{goal.name}</span>
                <GoalProgressBar progress={goal.progress} />
              </div>
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

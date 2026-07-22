import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const dashboardsListRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/dashboards",
  component: DashboardsListPage,
});

function DashboardsListPage() {
  const { workspaceId } = dashboardsListRoute.useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const dashboards = trpc.dashboard.list.useQuery({ workspaceId });
  const create = trpc.dashboard.create.useMutation({
    onSuccess: (dashboard) => {
      void utils.dashboard.list.invalidate({ workspaceId });
      void navigate({
        to: "/w/$workspaceId/dashboards/$dashboardId",
        params: { workspaceId, dashboardId: dashboard.id },
      });
    },
  });
  const [name, setName] = useState("");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate({ workspaceId, name: name.trim() || "Untitled dashboard" });
    setName("");
  }

  return (
    <div className="space-y-4 p-6" data-testid="dashboards-list-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboards</h1>
      </div>

      <form onSubmit={handleCreate} className="flex max-w-md gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New dashboard name"
          className="h-8 text-sm"
          data-testid="dashboards-new-name"
        />
        <Button type="submit" size="sm" disabled={create.isPending} data-testid="dashboards-create">
          {create.isPending ? "Creating…" : "New dashboard"}
        </Button>
      </form>

      {dashboards.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (dashboards.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-sm">
          No dashboards yet. Create one to chart tasks, time, and AI usage.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {dashboards.data?.map((dashboard) => (
            <li key={dashboard.id}>
              <Link
                to="/w/$workspaceId/dashboards/$dashboardId"
                params={{ workspaceId, dashboardId: dashboard.id }}
                data-testid={`dashboards-link-${dashboard.id}`}
                className="hover:bg-muted flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="font-medium">{dashboard.name}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(dashboard.updatedAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

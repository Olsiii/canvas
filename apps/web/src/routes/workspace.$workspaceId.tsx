import { HierarchySidebar } from "@/components/hierarchy-sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import { RequireAuth } from "@/components/require-auth";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const workspaceShellRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/w/$workspaceId",
  component: () => (
    <RequireAuth>
      <WorkspaceShell />
    </RequireAuth>
  ),
});

function WorkspaceShell() {
  const { workspaceId, listId } = useParams({ strict: false });
  const workspaces = trpc.workspace.listMine.useQuery();
  const workspace = workspaces.data?.find((w) => w.workspace.id === workspaceId)?.workspace;

  return (
    <div className="flex h-svh">
      <aside className="border-border flex w-64 shrink-0 flex-col border-r">
        <div className="border-border border-b px-3 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-muted-foreground hover:text-foreground text-xs">
              ← All workspaces
            </Link>
            <NotificationsBell />
          </div>
          <h1 className="truncate text-sm font-semibold">{workspace?.name ?? "Workspace"}</h1>
        </div>
        <div className="min-h-0 flex-1">
          {workspaceId && <HierarchySidebar workspaceId={workspaceId} activeListId={listId} />}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

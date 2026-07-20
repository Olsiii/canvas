import { BrainChatPanel } from "@/components/brain-chat-panel";
import { GenerationPanel } from "@/components/generation-panel";
import { HierarchySidebar } from "@/components/hierarchy-sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import { RequireAuth } from "@/components/require-auth";
import { SearchBox } from "@/components/search-box";
import { useRealtime } from "@/hooks/use-realtime";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useState } from "react";
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
  const [brainOpen, setBrainOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  useRealtime(workspaceId);

  return (
    <div className="flex h-svh">
      <aside className="border-border flex w-64 shrink-0 flex-col border-r">
        <div className="border-border border-b px-3 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-muted-foreground hover:text-foreground text-xs">
              ← All workspaces
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Generate image"
                onClick={() => setGenerateOpen(true)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Generate
              </button>
              <button
                type="button"
                aria-label="Open Brain"
                onClick={() => setBrainOpen(true)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Brain
              </button>
              <NotificationsBell />
            </div>
          </div>
          <h1 className="truncate text-sm font-semibold">{workspace?.name ?? "Workspace"}</h1>
          {workspaceId && (
            <div className="mt-2">
              <SearchBox workspaceId={workspaceId} />
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1">
          {workspaceId && <HierarchySidebar workspaceId={workspaceId} activeListId={listId} />}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      {brainOpen && workspaceId && (
        <BrainChatPanel
          workspaceId={workspaceId}
          contextType="global"
          onClose={() => setBrainOpen(false)}
        />
      )}
      {generateOpen && workspaceId && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            aria-label="Close generate panel"
            className="absolute inset-0 bg-black/20"
            onClick={() => setGenerateOpen(false)}
          />
          <div className="border-border bg-background relative h-full w-full max-w-md overflow-y-auto border-l p-4 shadow-xl">
            <GenerationPanel workspaceId={workspaceId} onClose={() => setGenerateOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

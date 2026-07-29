import { BrainChatPanel } from "@/components/brain-chat-panel";
import { CanvasLogo } from "@/components/canvas-logo";
import { DmToastContainer } from "@/components/dm-toast-container";
import { GenerationPanel } from "@/components/generation-panel";
import { HierarchySidebar } from "@/components/hierarchy-sidebar";
import { LoginSummaryPanel } from "@/components/login-summary-panel";
import { NotificationsBell } from "@/components/notifications-bell";
import { RequireAuth } from "@/components/require-auth";
import { RunningTimerWidget } from "@/components/running-timer-widget";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { WorkspaceNav } from "@/components/workspace-nav";
import { useDmNotifications } from "@/hooks/use-dm-notifications";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { useRealtime } from "@/hooks/use-realtime";
import { useSession } from "@/hooks/use-session";
import { Avatar } from "@/lib/avatar";
import { primeDmSoundOnFirstInteraction } from "@/lib/dm-sound";
import { trpc } from "@/lib/trpc";
import { createRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { ChevronLeft, LogOut, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  const membership = workspaces.data?.find((w) => w.workspace.id === workspaceId);
  const workspace = membership?.workspace;
  const { user } = useSession();
  const navigate = useNavigate();
  const logOut = trpc.auth.logOut.useMutation({
    onSuccess: () => navigate({ to: "/login" }),
  });
  const [brainOpen, setBrainOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const { containerRef: generatePanelRef, onKeyDown: generatePanelOnKeyDown } = useModalA11y(
    () => setGenerateOpen(false),
    generateOpen,
  );

  const handleDmNotificationEvent = useDmNotifications(workspaceId);
  useRealtime(workspaceId, handleDmNotificationEvent);
  useEffect(() => {
    primeDmSoundOnFirstInteraction();
  }, []);

  return (
    <div className="flex h-svh">
      <aside className="workspace-sidebar border-border bg-card text-foreground flex w-64 shrink-0 flex-col border-r">
        <div className="border-border flex items-center gap-3 border-b px-3 py-3">
          <Link to="/" aria-label="Canvas home" className="shrink-0">
            <CanvasLogo size={56} />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-[10px] tracking-wide uppercase"
            >
              <ChevronLeft className="h-3 w-3" aria-hidden />
              All workspaces
            </Link>
            <h1 className="truncate text-sm font-semibold">{workspace?.name ?? "Workspace"}</h1>
          </div>
          <NotificationsBell />
        </div>

        <div className="border-border space-y-2 border-b px-3 py-2.5">
          {workspaceId && <SearchBox workspaceId={workspaceId} />}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => setGenerateOpen(true)}
              aria-label="Generate image"
              title="Generate image"
            >
              <Wand2 className="h-3.5 w-3.5" aria-hidden />
              Generate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => setBrainOpen(true)}
              aria-label="Open Brain"
              title="Open Brain"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Brain
            </Button>
          </div>
          <RunningTimerWidget />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {workspaceId && <WorkspaceNav workspaceId={workspaceId} />}
          {workspaceId && (
            <>
              <div className="border-border my-3 border-t" />
              <HierarchySidebar workspaceId={workspaceId} activeListId={listId} />
            </>
          )}
        </div>

        <div className="border-border flex items-center gap-2 border-t px-3 py-2.5">
          <Link
            to="/account"
            className="hover:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 -m-1"
            aria-label="Account settings"
            title="Account settings"
          >
            <Avatar name={user?.name ?? user?.email ?? "?"} avatarUrl={user?.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name ?? user?.email}</p>
              {membership && (
                <p className="text-muted-foreground truncate text-xs capitalize">
                  {membership.role}
                </p>
              )}
            </div>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => logOut.mutate()}
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      {workspaceId && <LoginSummaryPanel workspaceId={workspaceId} />}
      <DmToastContainer />
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
            title="Close generate panel"
            className="absolute inset-0 bg-black/20"
            onClick={() => setGenerateOpen(false)}
          />
          <div
            ref={generatePanelRef}
            onKeyDown={generatePanelOnKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Generate image"
            tabIndex={-1}
            className="border-border bg-background relative h-full w-full max-w-md overflow-y-auto border-l p-4 shadow-xl outline-none"
          >
            <GenerationPanel
              workspaceId={workspaceId}
              listId={listId}
              onClose={() => setGenerateOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

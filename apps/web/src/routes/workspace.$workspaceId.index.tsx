import { MembersPanel } from "@/components/members-panel";
import { createRoute } from "@tanstack/react-router";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const workspaceHomeRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/",
  component: WorkspaceHome,
});

function WorkspaceHome() {
  const { workspaceId } = workspaceHomeRoute.useParams();
  return (
    <div>
      <p className="text-muted-foreground p-6 pb-0 text-sm">
        Select a list from the sidebar, or create a space to get started.
      </p>
      <MembersPanel workspaceId={workspaceId} />
    </div>
  );
}

import { BrandSettingsPanel } from "@/components/brand-settings-panel";
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
    <div className="space-y-8 p-6">
      <p className="text-muted-foreground text-sm">
        Select a list from the sidebar, or create a space to get started.
      </p>
      <BrandSettingsPanel workspaceId={workspaceId} />
      <MembersPanel workspaceId={workspaceId} />
    </div>
  );
}

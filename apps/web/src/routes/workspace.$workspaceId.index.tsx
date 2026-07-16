import { createRoute } from "@tanstack/react-router";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const workspaceHomeRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/",
  component: () => (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
      Select a list from the sidebar, or create a space to get started.
    </div>
  ),
});

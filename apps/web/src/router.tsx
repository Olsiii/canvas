import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { inviteRoute } from "./routes/invite.$inviteId";
import { loginRoute } from "./routes/login";
import { signupRoute } from "./routes/signup";
import { newWorkspaceRoute } from "./routes/workspaces.new";

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  newWorkspaceRoute,
  inviteRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

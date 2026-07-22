import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { inviteRoute } from "./routes/invite.$inviteId";
import { loginRoute } from "./routes/login";
import { signupRoute } from "./routes/signup";
import { publicFormRoute } from "./routes/forms.$publicToken";
import { workspaceShellRoute } from "./routes/workspace.$workspaceId";
import { workspaceHomeRoute } from "./routes/workspace.$workspaceId.index";
import { listRoute } from "./routes/workspace.$workspaceId.list.$listId";
import { timesheetRoute } from "./routes/workspace.$workspaceId.timesheet";
import { workloadRoute } from "./routes/workspace.$workspaceId.workload";
import { docsListRoute } from "./routes/workspace.$workspaceId.docs";
import { docEditorRoute } from "./routes/workspace.$workspaceId.docs.$docId";
import { chatChannelListRoute } from "./routes/workspace.$workspaceId.chat";
import { chatChannelRoute } from "./routes/workspace.$workspaceId.chat.$channelId";
import { formsListRoute } from "./routes/workspace.$workspaceId.forms";
import { formEditorRoute } from "./routes/workspace.$workspaceId.forms.$formId";
import { automationsListRoute } from "./routes/workspace.$workspaceId.automations";
import { automationEditorRoute } from "./routes/workspace.$workspaceId.automations.$automationId";
import { newWorkspaceRoute } from "./routes/workspaces.new";

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  newWorkspaceRoute,
  inviteRoute,
  publicFormRoute,
  workspaceShellRoute.addChildren([
    workspaceHomeRoute,
    listRoute,
    timesheetRoute,
    workloadRoute,
    docsListRoute,
    docEditorRoute,
    chatChannelListRoute,
    chatChannelRoute,
    formsListRoute,
    formEditorRoute,
    automationsListRoute,
    automationEditorRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

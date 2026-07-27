import type { FastifyInstance } from "fastify";
import { can } from "../auth/can";
import { getSessionUser } from "../auth/session";
import { logActivity } from "../lib/activity";
import { buildTasksCsv, buildWorkspaceExportJson } from "../lib/export";
import { getMembershipRole } from "../lib/membership";

// Plain REST routes, not tRPC procedures — a file download needs real HTTP
// response headers (Content-Type/Content-Disposition), same reason
// attachments.ts's upload/download routes and image-versions' thumb route
// aren't tRPC. Phase 6: data export.
export function registerExportRoutes(app: FastifyInstance) {
  app.get<{ Params: { workspaceId: string } }>(
    "/export/:workspaceId/tasks.csv",
    async (req, reply) => {
      const user = await getSessionUser(req);
      if (!user) return reply.code(401).send({ error: "Unauthorized" });

      const role = await getMembershipRole(req.params.workspaceId, user.id);
      if (!can(user, "export:run", { type: "workspace", role })) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const csv = await buildTasksCsv(req.params.workspaceId);
      await logActivity(
        req.params.workspaceId,
        user.id,
        "workspace",
        req.params.workspaceId,
        "export.tasksCsv",
      );

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", 'attachment; filename="tasks-export.csv"');
      return reply.send(csv);
    },
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/export/:workspaceId/workspace.json",
    async (req, reply) => {
      const user = await getSessionUser(req);
      if (!user) return reply.code(401).send({ error: "Unauthorized" });

      const role = await getMembershipRole(req.params.workspaceId, user.id);
      if (!can(user, "export:run", { type: "workspace", role })) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const data = await buildWorkspaceExportJson(req.params.workspaceId);
      await logActivity(
        req.params.workspaceId,
        user.id,
        "workspace",
        req.params.workspaceId,
        "export.workspaceJson",
      );

      reply.header("Content-Type", "application/json; charset=utf-8");
      reply.header("Content-Disposition", 'attachment; filename="workspace-export.json"');
      return reply.send(JSON.stringify(data, null, 2));
    },
  );
}

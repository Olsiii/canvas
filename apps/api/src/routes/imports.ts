import { db, schema } from "@canvas/db";
import type { CsvImportPayload } from "@canvas/shared";
import type { FastifyInstance } from "fastify";
import { can } from "../auth/can";
import { getSessionUser } from "../auth/session";
import { parseImportCsv } from "../lib/csv-import";
import { getMembershipRole } from "../lib/membership";
import { importQueue } from "../queues/import-queue";

// CSV upload is a plain multipart REST route, not a tRPC procedure — same
// reason as /uploads (attachments.ts): tRPC has no native file transport.
// A file straight from the person's computer — the Google Sheets import
// path (import.startGoogleSheet) fetches its CSV text server-side instead
// and has no file part to upload, so it's a plain tRPC mutation.
export function registerImportRoutes(app: FastifyInstance) {
  app.post("/imports/csv", async (req, reply) => {
    const user = await getSessionUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });

    let workspaceId: string | undefined;
    let spaceName: string | undefined;
    let listName: string | undefined;
    let csvText: string | undefined;

    for await (const part of req.parts()) {
      if (part.type === "file") {
        csvText = (await part.toBuffer()).toString("utf8");
      } else if (part.fieldname === "workspaceId" && typeof part.value === "string") {
        workspaceId = part.value;
      } else if (part.fieldname === "spaceName" && typeof part.value === "string") {
        spaceName = part.value;
      } else if (part.fieldname === "listName" && typeof part.value === "string") {
        listName = part.value;
      }
    }

    if (!workspaceId || !spaceName || !listName || !csvText) {
      return reply.code(400).send({ error: "Missing workspaceId, spaceName, listName, or file" });
    }

    const role = await getMembershipRole(workspaceId, user.id);
    if (!can(user, "import:run", { type: "workspace", role })) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    let rows;
    try {
      rows = parseImportCsv(csvText);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to parse CSV";
      return reply.code(400).send({ error: message });
    }
    if (rows.length === 0) {
      return reply.code(400).send({ error: "This CSV has no rows with a task name/title" });
    }

    const payload: CsvImportPayload = { rows, spaceName, listName };
    const [importRow] = await db
      .insert(schema.imports)
      .values({
        workspaceId,
        source: "csv",
        sourceDetail: "computer",
        status: "pending",
        payloadJson: payload,
        createdBy: user.id,
      })
      .returning();
    if (!importRow) return reply.code(500).send({ error: "Failed to start import" });

    await importQueue.add("csv", { importId: importRow.id });

    return reply.send({ importId: importRow.id, rowCount: rows.length });
  });
}

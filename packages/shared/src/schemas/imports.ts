import { z } from "zod";

// M5.5 importers: ClickUp via its REST API, Trello/Asana via CSV export.
export const IMPORT_SOURCES = ["clickup_api", "csv"] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

export const CSV_IMPORT_TOOLS = ["trello", "asana"] as const;
export type CsvImportTool = (typeof CSV_IMPORT_TOOLS)[number];

export const IMPORT_STATUSES = ["pending", "running", "done", "failed"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const listImportsSchema = z.object({ workspaceId: z.string().uuid() });

export const getImportSchema = z.object({ importId: z.string().uuid() });

export const startClickUpImportSchema = z.object({
  workspaceId: z.string().uuid(),
  apiToken: z.string().trim().min(1).max(500),
});

// One row parsed server-side from the uploaded CSV. Kept intentionally
// loose (all fields optional except title) since a CSV export's columns
// vary by tool/export settings — see csv-import.ts.
export const importedTaskRowSchema = z.object({
  title: z.string().min(1),
  statusName: z.string().nullable(),
  description: z.string().nullable(),
  assigneeEmail: z.string().nullable(),
  dueDate: z.string().nullable(),
  tags: z.array(z.string()),
});
export type ImportedTaskRow = z.infer<typeof importedTaskRowSchema>;

// What the CSV upload route (routes/imports.ts) writes into imports.payload_json
// and the worker (import-runner.ts) reads back — parsed with this schema on
// read rather than an unchecked `as` cast, same as automation-runner.ts's
// conditionsJson/actionsJson and dashboard.ts's widget configJson.
export const csvImportPayloadSchema = z.object({
  rows: z.array(importedTaskRowSchema).min(1),
  spaceName: z.string().min(1),
  listName: z.string().min(1),
});
export type CsvImportPayload = z.infer<typeof csvImportPayloadSchema>;

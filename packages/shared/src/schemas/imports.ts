import { z } from "zod";

// Two ways a CSV row set can reach the same importer: a file uploaded
// straight from the person's computer, or fetched server-side from a
// published Google Sheet — either way it funnels into the same
// tool-agnostic column-alias parsing (see csv-import.ts).
export const IMPORT_SOURCES = ["csv"] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

export const CSV_IMPORT_ORIGINS = ["computer", "google_sheets"] as const;
export type CsvImportOrigin = (typeof CSV_IMPORT_ORIGINS)[number];

export const IMPORT_STATUSES = ["pending", "running", "done", "failed"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const listImportsSchema = z.object({ workspaceId: z.string().uuid() });

export const getImportSchema = z.object({ importId: z.string().uuid() });

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

export const startGoogleSheetImportSchema = z.object({
  workspaceId: z.string().uuid(),
  spaceName: z.string().min(1),
  listName: z.string().min(1),
  // A published-to-web CSV export link (Google Sheets: File > Share >
  // Publish to web > CSV), fetched server-side — validated further at the
  // route boundary (host must actually be a Google domain) to keep this
  // from becoming an open server-side-fetch proxy for arbitrary URLs.
  sheetUrl: z.string().trim().url(),
});

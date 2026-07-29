import { db, schema } from "@canvas/db";
import {
  getImportSchema,
  listImportsSchema,
  startGoogleSheetImportSchema,
  type CsvImportPayload,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { parseImportCsv } from "../../lib/csv-import";
import { assertCan } from "../../lib/permissions";
import { assertSafeOutboundUrl, safeFetch } from "../../lib/safe-outbound-url";
import { importQueue } from "../../queues/import-queue";
import { protectedProcedure, router } from "../trpc";

// Same request-handler-outbound-fetch timeout as the queued webhook/Slack
// deliveries (worker.ts) — this one runs inline in the mutation rather than
// a background job, so it needs its own bound just as much.
const GOOGLE_SHEET_FETCH_TIMEOUT_MS = 10_000;

export const importRouter = router({
  list: protectedProcedure.input(listImportsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "import:run");

    // Never selects payloadJson — it can be the entire parsed board, which
    // the history list has no use for.
    return db
      .select({
        id: schema.imports.id,
        workspaceId: schema.imports.workspaceId,
        source: schema.imports.source,
        sourceDetail: schema.imports.sourceDetail,
        status: schema.imports.status,
        summaryJson: schema.imports.summaryJson,
        error: schema.imports.error,
        createdBy: schema.imports.createdBy,
        createdAt: schema.imports.createdAt,
        updatedAt: schema.imports.updatedAt,
      })
      .from(schema.imports)
      .where(eq(schema.imports.workspaceId, input.workspaceId))
      .orderBy(desc(schema.imports.createdAt));
  }),

  get: protectedProcedure.input(getImportSchema).query(async ({ ctx, input }) => {
    const [row] = await db
      .select({
        id: schema.imports.id,
        workspaceId: schema.imports.workspaceId,
        source: schema.imports.source,
        sourceDetail: schema.imports.sourceDetail,
        status: schema.imports.status,
        summaryJson: schema.imports.summaryJson,
        error: schema.imports.error,
        createdBy: schema.imports.createdBy,
        createdAt: schema.imports.createdAt,
        updatedAt: schema.imports.updatedAt,
      })
      .from(schema.imports)
      .where(eq(schema.imports.id, input.importId))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    await assertCan(ctx.user, row.workspaceId, "import:run");
    return row;
  }),

  // No file to upload here (tRPC handles this fine, unlike the /imports/csv
  // REST route) — the CSV text is fetched server-side from a published
  // Google Sheet link instead. Host-restricted to Google's own domain
  // *and* run through the same SSRF guard (assertSafeOutboundUrl) the
  // webhook/Slack delivery paths use, so this can't become a proxy for
  // reaching private/internal/metadata addresses even via a hostname that
  // happens to resolve there.
  startGoogleSheet: protectedProcedure
    .input(startGoogleSheetImportSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "import:run");

      const hostname = new URL(input.sheetUrl).hostname;
      if (!/(^|\.)google\.com$/.test(hostname)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Must be a Google Sheets link (docs.google.com)",
        });
      }

      try {
        await assertSafeOutboundUrl(input.sheetUrl);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Invalid sheet URL",
        });
      }

      // safeFetch re-validates (cheap — one extra DNS lookup on this
      // low-frequency, admin-triggered path) and, unlike the plain fetch()
      // this replaced, pins the request to the exact address it just
      // validated — closing the gap where a separate assertSafeOutboundUrl
      // call followed by an independent fetch() could resolve somewhere
      // different (DNS rebinding) the second time around.
      const response = await safeFetch(input.sheetUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(GOOGLE_SHEET_FETCH_TIMEOUT_MS),
      }).catch(() => null);
      if (!response || !response.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Couldn't fetch that sheet. Make sure it's published to the web as CSV (File > Share > Publish to web > CSV).",
        });
      }
      const csvText = await response.text();

      let rows;
      try {
        rows = parseImportCsv(csvText);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Failed to parse the sheet",
        });
      }
      if (rows.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This sheet has no rows with a task name/title",
        });
      }

      const payload: CsvImportPayload = {
        rows,
        spaceName: input.spaceName,
        listName: input.listName,
      };
      const [importRow] = await db
        .insert(schema.imports)
        .values({
          workspaceId: input.workspaceId,
          source: "csv",
          sourceDetail: "google_sheets",
          status: "pending",
          payloadJson: payload,
          createdBy: ctx.user.id,
        })
        .returning();
      if (!importRow) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await importQueue.add("csv", { importId: importRow.id });

      return { importId: importRow.id, rowCount: rows.length };
    }),
});

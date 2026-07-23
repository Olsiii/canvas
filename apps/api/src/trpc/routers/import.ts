import { db, schema } from "@canvas/db";
import { getImportSchema, listImportsSchema, startClickUpImportSchema } from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { assertCan } from "../../lib/permissions";
import { importQueue } from "../../queues/import-queue";
import { protectedProcedure, router } from "../trpc";

export const importRouter = router({
  list: protectedProcedure.input(listImportsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "import:run");

    // Never selects payloadJson — for a ClickUp import it holds nothing
    // secret (see schema/imports.ts), but for CSV it can be the entire
    // parsed board, which the history list has no use for.
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

  startClickUp: protectedProcedure
    .input(startClickUpImportSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCan(ctx.user, input.workspaceId, "import:run");

      const [importRow] = await db
        .insert(schema.imports)
        .values({
          workspaceId: input.workspaceId,
          source: "clickup_api",
          status: "pending",
          createdBy: ctx.user.id,
        })
        .returning();
      if (!importRow) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // The token is never written to the imports row (see schema/
      // imports.ts) — it only ever exists in this request and as BullMQ
      // job data, read once by the worker and then gone.
      await importQueue.add("clickup", { importId: importRow.id, apiToken: input.apiToken });

      return { importId: importRow.id };
    }),
});

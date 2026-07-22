import { db, schema } from "@canvas/db";
import {
  createFormSchema,
  deleteFormSchema,
  formSchemaSchema,
  getFormSchema,
  getPublicFormSchema,
  listFormsSchema,
  submitPublicFormSchema,
  updateFormSchema,
  type FormSchema,
} from "@canvas/shared";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity";
import { buildTaskFromSubmission, validateFormSubmission } from "../../lib/form-submission";
import { requireList } from "../../lib/hierarchy";
import { nextOrderKey } from "../../lib/order";
import { assertCan } from "../../lib/permissions";
import { publish } from "../../lib/realtime";
import { firstStatusForList, lastTaskOrderKey } from "../../lib/task-queries";
import { protectedProcedure, publicProcedure, router } from "../trpc";

async function requireForm(formId: string) {
  const form = await db.query.forms.findFirst({ where: eq(schema.forms.id, formId) });
  if (!form) throw new TRPCError({ code: "NOT_FOUND" });
  return form;
}

function parseFormSchema(schemaJson: unknown): FormSchema {
  return formSchemaSchema.parse(schemaJson);
}

export const formRouter = router({
  list: protectedProcedure.input(listFormsSchema).query(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "form:view");

    return db
      .select()
      .from(schema.forms)
      .where(eq(schema.forms.workspaceId, input.workspaceId))
      .orderBy(asc(schema.forms.name));
  }),

  get: protectedProcedure.input(getFormSchema).query(async ({ ctx, input }) => {
    const form = await requireForm(input.formId);
    await assertCan(ctx.user, form.workspaceId, "form:view");
    return form;
  }),

  create: protectedProcedure.input(createFormSchema).mutation(async ({ ctx, input }) => {
    await assertCan(ctx.user, input.workspaceId, "form:create");

    const list = await requireList(input.listId);
    // Cross-workspace guard, same shape as task-template.instantiate: resolve
    // the list's own workspace via its space and compare.
    const listSpace = await db.query.spaces.findFirst({
      where: eq(schema.spaces.id, list.spaceId),
    });
    if (!listSpace || listSpace.workspaceId !== input.workspaceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "List does not belong to this workspace",
      });
    }

    const schemaJson: FormSchema = parseFormSchema({ fields: input.fields });

    const [form] = await db
      .insert(schema.forms)
      .values({
        workspaceId: input.workspaceId,
        listId: input.listId,
        name: input.name,
        schemaJson,
        createdBy: ctx.user.id,
      })
      .returning();
    if (!form) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(input.workspaceId, ctx.user.id, "form", form.id, "form.created");
    return form;
  }),

  update: protectedProcedure.input(updateFormSchema).mutation(async ({ ctx, input }) => {
    const form = await requireForm(input.formId);
    await assertCan(ctx.user, form.workspaceId, "form:update");

    const schemaJson =
      input.fields !== undefined ? parseFormSchema({ fields: input.fields }) : undefined;

    const [updated] = await db
      .update(schema.forms)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(schemaJson !== undefined ? { schemaJson } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.forms.id, form.id))
      .returning();
    if (!updated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(form.workspaceId, ctx.user.id, "form", form.id, "form.updated");
    return updated;
  }),

  delete: protectedProcedure.input(deleteFormSchema).mutation(async ({ ctx, input }) => {
    const form = await requireForm(input.formId);
    await assertCan(ctx.user, form.workspaceId, "form:delete");

    await db.delete(schema.forms).where(eq(schema.forms.id, form.id));

    await logActivity(form.workspaceId, ctx.user.id, "form", form.id, "form.deleted");
    return { id: form.id };
  }),

  // Public, unauthenticated surface — an external submitter never has a
  // session, so these two never call `assertCan`/`can` at all. Only what's
  // needed to render/submit the intake form is exposed; workspaceId/listId
  // stay server-side.
  getPublic: publicProcedure.input(getPublicFormSchema).query(async ({ input }) => {
    const form = await db.query.forms.findFirst({
      where: eq(schema.forms.publicToken, input.publicToken),
    });
    if (!form) throw new TRPCError({ code: "NOT_FOUND" });

    const parsed = parseFormSchema(form.schemaJson);
    return { name: form.name, fields: parsed.fields };
  }),

  submitPublic: publicProcedure.input(submitPublicFormSchema).mutation(async ({ input }) => {
    const form = await db.query.forms.findFirst({
      where: eq(schema.forms.publicToken, input.publicToken),
    });
    if (!form) throw new TRPCError({ code: "NOT_FOUND" });

    const parsed = parseFormSchema(form.schemaJson);
    const errors = validateFormSubmission(parsed.fields, input.values);
    if (errors.length > 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: errors.join("; ") });
    }

    const { title, descriptionJson } = buildTaskFromSubmission(parsed.fields, input.values);
    const status = await firstStatusForList(form.listId);
    const lastKey = await lastTaskOrderKey(form.listId, status.id);

    const [task] = await db
      .insert(schema.tasks)
      .values({
        listId: form.listId,
        title,
        descriptionJson,
        statusId: status.id,
        orderKey: nextOrderKey(lastKey),
        createdBy: form.createdBy,
      })
      .returning();
    if (!task) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await logActivity(form.workspaceId, form.createdBy, "task", task.id, "task.created_from_form", {
      formId: form.id,
    });
    await publish(form.workspaceId, {
      entity: "task",
      id: task.id,
      listId: task.listId,
      kind: "created",
    });

    return { taskId: task.id };
  }),
});

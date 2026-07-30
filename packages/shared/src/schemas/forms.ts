import { z } from "zod";

// M4.5 "Forms → task intake". `schema_json` (DATA_MODEL.md) holds a list of
// fields; the field with id TITLE_FIELD_ID always exists and maps straight
// to the created task's title, mirroring how task_templates.payload_json
// captures title/description separately rather than as free-form prose.
export const TITLE_FIELD_ID = "title";

export const FORM_FIELD_TYPES = ["short_text", "long_text", "select"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const formFieldSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9_-]+$/, "Field id must be lowercase letters, numbers, _ or -"),
    label: z.string().trim().min(1).max(200),
    type: z.enum(FORM_FIELD_TYPES),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  })
  .refine((f) => f.type !== "select" || (f.options && f.options.length > 0), {
    message: "A select field needs at least one option",
    path: ["options"],
  });
export type FormField = z.infer<typeof formFieldSchema>;

// Pure shape validation for what's actually stored in `schema_json` — no
// mode-specific business rule (an intake form needing a title field) here,
// since a task-completion form's stored schema legitimately has zero
// fields. That rule lives in createFormSchema/the form.update handler,
// which know whether the form being written is bound to a task.
export const formSchemaSchema = z
  .object({ fields: z.array(formFieldSchema).max(20) })
  .refine((s) => new Set(s.fields.map((f) => f.id)).size === s.fields.length, {
    message: "Field ids must be unique",
    path: ["fields"],
  });
export type FormSchema = z.infer<typeof formSchemaSchema>;

export function hasTitleField(fields: FormField[]): boolean {
  return fields.length > 0 && fields.some((f) => f.id === TITLE_FIELD_ID);
}

export const listFormsSchema = z.object({ workspaceId: z.string().uuid() });

export const getFormSchema = z.object({ formId: z.string().uuid() });

export const createFormSchema = z
  .object({
    workspaceId: z.string().uuid(),
    listId: z.string().uuid(),
    name: z.string().trim().min(1).max(200),
    // Bind to one existing task ("task completion" mode) instead of
    // building a new one from fields ("intake" mode, the default).
    taskId: z.string().uuid().optional(),
    fields: z.array(formFieldSchema).max(20),
  })
  .refine((v) => v.taskId !== undefined || hasTitleField(v.fields), {
    message: `An intake form must include a "${TITLE_FIELD_ID}" field`,
    path: ["fields"],
  })
  .refine((v) => new Set(v.fields.map((f) => f.id)).size === v.fields.length, {
    message: "Field ids must be unique",
    path: ["fields"],
  });

export const updateFormSchema = z.object({
  formId: z.string().uuid(),
  name: z.string().trim().min(1).max(200).optional(),
  // undefined = leave the task binding untouched; null = unbind back to
  // intake mode; a uuid = bind (or rebind) to that task.
  taskId: z.string().uuid().nullable().optional(),
  fields: z.array(formFieldSchema).max(20).optional(),
});

export const deleteFormSchema = z.object({ formId: z.string().uuid() });

export const getPublicFormSchema = z.object({ publicToken: z.string().uuid() });

export const submitPublicFormSchema = z.object({
  publicToken: z.string().uuid(),
  // Intake-mode forms require these; a task-completion form has no custom
  // fields, so both are omitted from that submission entirely.
  values: z.record(z.string(), z.string().max(5000)).optional(),
  submitterName: z.string().trim().min(1).max(200).optional(),
});

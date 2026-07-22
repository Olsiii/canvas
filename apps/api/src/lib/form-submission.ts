import { TITLE_FIELD_ID, type FormField } from "@canvas/shared";

/**
 * Pure validation for a public form submission: every required field must
 * have a non-blank value, and a `select` field's value must be one of its
 * configured options. Returns a list of error messages (empty = valid).
 */
export function validateFormSubmission(
  fields: FormField[],
  values: Record<string, string>,
): string[] {
  const errors: string[] = [];

  for (const field of fields) {
    const value = values[field.id]?.trim() ?? "";
    if (field.required && value.length === 0) {
      errors.push(`"${field.label}" is required`);
      continue;
    }
    if (value.length > 0 && field.type === "select" && !field.options?.includes(value)) {
      errors.push(`"${field.label}" must be one of the offered options`);
    }
  }

  return errors;
}

/**
 * Builds the task fields a submission produces: the title field's value
 * becomes the task title, and every other answered field becomes a
 * "Label: value" paragraph in the task's TipTap description — descriptions
 * are always TipTap JSON (CLAUDE.md), never a plain string.
 */
export function buildTaskFromSubmission(fields: FormField[], values: Record<string, string>) {
  const title = values[TITLE_FIELD_ID]?.trim() ?? "";

  const paragraphs = fields
    .filter((f) => f.id !== TITLE_FIELD_ID)
    .map((f) => ({ field: f, value: values[f.id]?.trim() ?? "" }))
    .filter(({ value }) => value.length > 0)
    .map(({ field, value }) => ({
      type: "paragraph",
      content: [{ type: "text", text: `${field.label}: ${value}` }],
    }));

  return {
    title,
    descriptionJson: { type: "doc", content: paragraphs },
  };
}

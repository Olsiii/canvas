import type { CustomFieldType } from "@canvas/shared";

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function optionsFrom(optionsJson: unknown): string[] {
  if (!optionsJson || typeof optionsJson !== "object") return [];
  const options = (optionsJson as { options?: unknown }).options;
  return Array.isArray(options) ? options.filter((o): o is string => typeof o === "string") : [];
}

/**
 * Validates a custom field value against its field def's type (and, for
 * dropdown/label, its configured options). Returns an error message, or
 * null if valid.
 */
export function validateCustomFieldValue(
  type: CustomFieldType,
  value: unknown,
  optionsJson: unknown,
): string | null {
  switch (type) {
    case "text":
      return typeof value === "string" ? null : "Value must be text";
    case "number":
    case "currency":
      return typeof value === "number" && Number.isFinite(value) ? null : "Value must be a number";
    case "checkbox":
      return typeof value === "boolean" ? null : "Value must be true or false";
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? null
        : "Value must be a date (YYYY-MM-DD)";
    case "url":
    case "image":
      return typeof value === "string" && isValidUrl(value) ? null : "Value must be a valid URL";
    case "dropdown": {
      const options = optionsFrom(optionsJson);
      return typeof value === "string" && options.includes(value)
        ? null
        : `Value must be one of: ${options.join(", ")}`;
    }
    case "label": {
      const options = optionsFrom(optionsJson);
      return Array.isArray(value) &&
        value.every((v) => typeof v === "string" && options.includes(v))
        ? null
        : `Value must be an array of: ${options.join(", ")}`;
    }
  }
}

/** Dropdown/label field defs need at least one configured option. */
export function validateCustomFieldOptions(
  type: CustomFieldType,
  optionsJson: unknown,
): string | null {
  if (type !== "dropdown" && type !== "label") return null;
  return optionsFrom(optionsJson).length > 0
    ? null
    : "Dropdown and label fields need at least one option";
}

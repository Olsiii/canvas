export const CUSTOM_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "dropdown",
  "label",
  "checkbox",
  "url",
  "currency",
  "image",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

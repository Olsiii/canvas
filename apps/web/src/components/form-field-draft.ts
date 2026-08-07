import type { FormField } from "@canvas/shared";

export function newFormField(): FormField {
  return {
    id: `field-${crypto.randomUUID().slice(0, 8)}`,
    label: "",
    type: "short_text",
    required: false,
  };
}

import { newFormField } from "@/components/form-field-draft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FORM_FIELD_TYPES,
  TITLE_FIELD_ID,
  type FormField,
  type FormFieldType,
} from "@canvas/shared";

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  select: "Select",
};

/** Builder UI for a form's `schema_json.fields` (M4.5). The "title" field is
 * always present and always maps to the created task's title, so it's
 * pinned first and can't be removed or retyped — only its label is
 * editable, letting a builder ask e.g. "What's broken?" instead of "Title". */
export function FormFieldsEditor({
  fields,
  onChange,
}: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}) {
  const titleField = fields.find((f) => f.id === TITLE_FIELD_ID) ?? {
    id: TITLE_FIELD_ID,
    label: "Title",
    type: "short_text" as const,
    required: true,
  };
  const otherFields = fields.filter((f) => f.id !== TITLE_FIELD_ID);

  function update(id: string, patch: Partial<FormField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function remove(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  function add() {
    onChange([...fields, newFormField()]);
  }

  return (
    <div className="space-y-3">
      <div className="border-border flex items-center gap-2 rounded-md border p-2">
        <Input
          value={titleField.label}
          onChange={(e) => update(TITLE_FIELD_ID, { label: e.target.value })}
          placeholder="Title field label"
          className="h-8 text-sm"
          data-testid="form-field-title-label"
        />
        <span className="text-muted-foreground shrink-0 text-xs">Title · required</span>
      </div>

      {otherFields.map((field) => (
        <div key={field.id} className="border-border space-y-2 rounded-md border p-2">
          <div className="flex items-center gap-2">
            <Input
              value={field.label}
              onChange={(e) => update(field.id, { label: e.target.value })}
              placeholder="Field label"
              className="h-8 text-sm"
              data-testid="form-field-label"
            />
            <select
              value={field.type}
              onChange={(e) => update(field.id, { type: e.target.value as FormFieldType })}
              className="border-border bg-background h-8 shrink-0 rounded border text-xs"
            >
              {FORM_FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {FIELD_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <label className="flex shrink-0 items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => update(field.id, { required: e.target.checked })}
              />
              Required
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(field.id)}
              aria-label={`Remove field ${field.label || field.id}`}
              title={`Remove field ${field.label || field.id}`}
            >
              ✕
            </Button>
          </div>
          {field.type === "select" && (
            <Input
              value={(field.options ?? []).join(", ")}
              onChange={(e) =>
                update(field.id, {
                  options: e.target.value
                    .split(",")
                    .map((o) => o.trim())
                    .filter((o) => o.length > 0),
                })
              }
              placeholder="Options, comma separated"
              className="h-8 text-sm"
              data-testid="form-field-options"
            />
          )}
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add} data-testid="form-add-field">
        Add field
      </Button>
    </div>
  );
}

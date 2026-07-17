import type { AppRouter } from "@canvas/api";
import { CUSTOM_FIELD_TYPES, type CustomFieldType } from "@canvas/shared";
import { Section } from "@/components/detail-field";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type FieldWithValue = RouterOutputs["customField"]["values"]["listForTask"][number];

const TYPE_LABEL: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  label: "Label",
  checkbox: "Checkbox",
  url: "URL",
  currency: "Currency",
  image: "Image",
};

export function CustomFieldsSection({
  taskId,
  workspaceId,
  listId,
}: {
  taskId: string;
  workspaceId: string;
  listId: string;
}) {
  const utils = trpc.useUtils();
  const fields = trpc.customField.values.listForTask.useQuery({ taskId });
  const invalidate = () => utils.customField.values.listForTask.invalidate({ taskId });

  const setValue = trpc.customField.values.set.useMutation({ onSuccess: invalidate });
  const createDef = trpc.customField.defs.create.useMutation({
    onSuccess: () => {
      invalidate();
      setAdding(false);
    },
  });

  const [adding, setAdding] = useState(false);

  return (
    <Section label="Custom fields">
      <div className="space-y-2">
        {(fields.data ?? []).map((field) => (
          <CustomFieldRow
            key={field.id}
            field={field}
            onChange={(valueJson) => setValue.mutate({ fieldDefId: field.id, taskId, valueJson })}
          />
        ))}

        {adding ? (
          <NewCustomFieldForm
            isPending={createDef.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(name, type, optionsJson) =>
              createDef.mutate({ workspaceId, listId, name, type, optionsJson })
            }
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            + Add field
          </button>
        )}
      </div>
    </Section>
  );
}

function CustomFieldRow({
  field,
  onChange,
}: {
  field: FieldWithValue;
  onChange: (valueJson: unknown) => void;
}) {
  const [local, setLocal] = useState<unknown>(field.value);
  useEffect(() => setLocal(field.value), [field.value]);

  const options = (field.optionsJson as { options?: string[] } | null)?.options ?? [];

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-24 shrink-0 truncate text-xs" title={field.name}>
        {field.name}
      </span>

      {field.type === "text" && (
        <Input
          value={typeof local === "string" ? local : ""}
          aria-label={field.name}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(local || null)}
          className="h-7 flex-1 text-xs"
        />
      )}

      {field.type === "url" && (
        <Input
          type="url"
          value={typeof local === "string" ? local : ""}
          aria-label={field.name}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onChange(local || null)}
          className="h-7 flex-1 text-xs"
        />
      )}

      {field.type === "image" && (
        <div className="flex flex-1 items-center gap-2">
          <Input
            type="url"
            value={typeof local === "string" ? local : ""}
            aria-label={field.name}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => onChange(local || null)}
            className="h-7 flex-1 text-xs"
          />
          {typeof field.value === "string" && field.value && (
            <img src={field.value} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
          )}
        </div>
      )}

      {(field.type === "number" || field.type === "currency") && (
        <div className="flex flex-1 items-center gap-1">
          {field.type === "currency" && <span className="text-muted-foreground text-xs">$</span>}
          <Input
            type="number"
            value={typeof local === "number" ? local : ""}
            aria-label={field.name}
            onChange={(e) => setLocal(e.target.value === "" ? null : Number(e.target.value))}
            onBlur={() => onChange(local)}
            className="h-7 flex-1 text-xs"
          />
        </div>
      )}

      {field.type === "date" && (
        <Input
          type="date"
          value={typeof local === "string" ? local : ""}
          aria-label={field.name}
          onChange={(e) => {
            const v = e.target.value || null;
            setLocal(v);
            onChange(v);
          }}
          className="h-7 flex-1 text-xs"
        />
      )}

      {field.type === "checkbox" && (
        <input
          type="checkbox"
          checked={Boolean(local)}
          aria-label={field.name}
          onChange={(e) => {
            setLocal(e.target.checked);
            onChange(e.target.checked);
          }}
        />
      )}

      {field.type === "dropdown" && (
        <select
          value={typeof local === "string" ? local : ""}
          aria-label={field.name}
          onChange={(e) => {
            const v = e.target.value || null;
            setLocal(v);
            onChange(v);
          }}
          className="border-border bg-background h-7 flex-1 rounded border text-xs"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}

      {field.type === "label" && (
        <div className="flex flex-1 flex-wrap gap-1">
          {options.map((o) => {
            const selected = Array.isArray(local) && local.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => {
                  const current = Array.isArray(local) ? (local as string[]) : [];
                  const next = selected ? current.filter((v) => v !== o) : [...current, o];
                  setLocal(next);
                  onChange(next.length ? next : null);
                }}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  selected ? "bg-foreground text-background" : "border-border"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewCustomFieldForm({
  isPending,
  onCancel,
  onSubmit,
}: {
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (name: string, type: CustomFieldType, optionsJson?: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const needsOptions = type === "dropdown" || type === "label";
  const options = optionsText
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || (needsOptions && options.length === 0)) return;
        onSubmit(name.trim(), type, needsOptions ? { options } : undefined);
      }}
    >
      <Input
        autoFocus
        value={name}
        placeholder="Field name"
        aria-label="New field name"
        onChange={(e) => setName(e.target.value)}
        className="h-7 text-xs"
      />
      <select
        value={type}
        aria-label="New field type"
        onChange={(e) => setType(e.target.value as CustomFieldType)}
        className="border-border bg-background h-7 w-full rounded border text-xs"
      >
        {CUSTOM_FIELD_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      {needsOptions && (
        <Input
          value={optionsText}
          placeholder="Comma-separated options"
          aria-label="New field options"
          onChange={(e) => setOptionsText(e.target.value)}
          className="h-7 text-xs"
        />
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !name.trim() || (needsOptions && options.length === 0)}
          className="text-xs disabled:opacity-50"
        >
          Add field
        </button>
        <button type="button" onClick={onCancel} className="text-muted-foreground text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}

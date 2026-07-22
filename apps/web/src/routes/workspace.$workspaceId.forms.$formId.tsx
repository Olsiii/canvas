import { FormFieldsEditor } from "@/components/form-fields-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { formSchemaSchema, type FormField } from "@canvas/shared";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const formEditorRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/forms/$formId",
  component: FormEditorPage,
});

function FormEditorPage() {
  const { workspaceId, formId } = formEditorRoute.useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const form = trpc.form.get.useQuery({ formId });

  const [name, setName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!form.data) return;
    setName(form.data.name);
    setFields(formSchemaSchema.parse(form.data.schemaJson).fields);
  }, [form.data]);

  const update = trpc.form.update.useMutation({
    onSuccess: () => void utils.form.get.invalidate({ formId }),
  });
  const remove = trpc.form.delete.useMutation({
    onSuccess: () => {
      void utils.form.list.invalidate({ workspaceId });
      void navigate({ to: "/w/$workspaceId/forms", params: { workspaceId } });
    },
  });

  function handleSave(e: FormEvent) {
    e.preventDefault();
    update.mutate({ formId, name: name.trim() || "Untitled form", fields });
  }

  if (form.isLoading || !form.data) {
    return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;
  }

  const publicUrl = `${window.location.origin}/forms/${form.data.publicToken}`;

  return (
    <div className="max-w-lg space-y-4 p-6" data-testid="form-editor-page">
      <h1 className="text-lg font-semibold">Edit form</h1>

      <div className="border-border space-y-1 rounded-md border p-3">
        <p className="text-xs font-medium">Public link</p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={publicUrl}
            className="h-8 text-xs"
            data-testid="form-public-link"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(publicUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Anyone with this link can submit — no login required.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Form name"
          className="h-8 text-sm"
          data-testid="form-editor-name"
        />

        <FormFieldsEditor fields={fields} onChange={setFields} />

        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={update.isPending}
            data-testid="form-editor-save"
          >
            {update.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove.mutate({ formId })}
            data-testid="form-editor-delete"
          >
            Delete form
          </Button>
        </div>
        {update.error && <p className="text-xs text-red-500">{update.error.message}</p>}
      </form>
    </div>
  );
}

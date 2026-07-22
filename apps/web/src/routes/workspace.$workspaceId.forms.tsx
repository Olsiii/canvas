import { FormFieldsEditor } from "@/components/form-fields-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { TITLE_FIELD_ID, type FormField } from "@canvas/shared";
import { createRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

export const formsListRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/forms",
  component: FormsListPage,
});

const DEFAULT_FIELDS: FormField[] = [
  { id: TITLE_FIELD_ID, label: "Title", type: "short_text", required: true },
];

function FormsListPage() {
  const { workspaceId } = formsListRoute.useParams();
  const utils = trpc.useUtils();
  const forms = trpc.form.list.useQuery({ workspaceId });
  const tree = trpc.hierarchy.tree.useQuery({ workspaceId });

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [listId, setListId] = useState("");
  const [fields, setFields] = useState<FormField[]>(DEFAULT_FIELDS);

  const create = trpc.form.create.useMutation({
    onSuccess: () => {
      void utils.form.list.invalidate({ workspaceId });
      setCreating(false);
      setName("");
      setFields(DEFAULT_FIELDS);
      setListId("");
    },
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!listId) return;
    create.mutate({ workspaceId, listId, name: name.trim() || "Untitled form", fields });
  }

  const listOptions =
    tree.data?.lists.map((list) => {
      const space = tree.data?.spaces.find((s) => s.id === list.spaceId);
      return { id: list.id, label: space ? `${space.name} / ${list.name}` : list.name };
    }) ?? [];

  return (
    <div className="space-y-4 p-6" data-testid="forms-list-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Forms</h1>
        {!creating && (
          <Button size="sm" onClick={() => setCreating(true)} data-testid="forms-new">
            New form
          </Button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="border-border max-w-lg space-y-3 rounded-md border p-4"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Form name"
            className="h-8 text-sm"
            data-testid="forms-new-name"
          />
          <select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className="border-border bg-background h-8 w-full rounded border text-sm"
            data-testid="forms-new-list"
          >
            <option value="">Select a list…</option>
            {listOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>

          <FormFieldsEditor fields={fields} onChange={setFields} />

          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={create.isPending || !listId}
              data-testid="forms-create-submit"
            >
              {create.isPending ? "Creating…" : "Create form"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
          {create.error && <p className="text-xs text-red-500">{create.error.message}</p>}
        </form>
      )}

      {forms.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (forms.data?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground text-sm">
          No forms yet. Create one to let people submit tasks without logging in.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {forms.data?.map((form) => (
            <li key={form.id}>
              <Link
                to="/w/$workspaceId/forms/$formId"
                params={{ workspaceId, formId: form.id }}
                data-testid={`forms-link-${form.id}`}
                className="hover:bg-muted flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="font-medium">{form.name}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(form.updatedAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

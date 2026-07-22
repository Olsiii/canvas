import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { TITLE_FIELD_ID } from "@canvas/shared";
import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import { rootRoute } from "./__root";

export const publicFormRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forms/$publicToken",
  component: PublicFormPage,
});

function PublicFormPage() {
  const { publicToken } = publicFormRoute.useParams();
  const form = trpc.form.getPublic.useQuery({ publicToken });
  const [values, setValues] = useState<Record<string, string>>({});
  const submit = trpc.form.submitPublic.useMutation();

  if (form.isLoading) {
    return <p className="text-muted-foreground p-8 text-sm">Loading…</p>;
  }

  if (!form.data) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4 text-center">
        <p>This form link is no longer valid.</p>
      </main>
    );
  }

  if (submit.isSuccess) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-lg font-medium">Thanks — your submission was received.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-10" data-testid="public-form-page">
      <h1 className="text-lg font-semibold">{form.data.name}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate({ publicToken, values });
        }}
        className="space-y-4"
      >
        {form.data.fields.map((field) => (
          <div key={field.id} className="space-y-1">
            <label htmlFor={`field-${field.id}`} className="block text-sm font-medium">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
            </label>
            {field.type === "long_text" ? (
              <textarea
                id={`field-${field.id}`}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                required={field.required}
                rows={4}
                className="border-border focus-visible:ring-primary w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2"
                data-testid={`public-form-field-${field.id}`}
              />
            ) : field.type === "select" ? (
              <select
                id={`field-${field.id}`}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                required={field.required}
                className="border-border bg-background h-9 w-full rounded-md border text-sm"
                data-testid={`public-form-field-${field.id}`}
              >
                <option value="">Select…</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={`field-${field.id}`}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                required={field.required}
                autoFocus={field.id === TITLE_FIELD_ID}
                data-testid={`public-form-field-${field.id}`}
              />
            )}
          </div>
        ))}

        <Button type="submit" disabled={submit.isPending} data-testid="public-form-submit">
          {submit.isPending ? "Submitting…" : "Submit"}
        </Button>
        {submit.error && <p className="text-sm text-red-500">{submit.error.message}</p>}
      </form>
    </main>
  );
}

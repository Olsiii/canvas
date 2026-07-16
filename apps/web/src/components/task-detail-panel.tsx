import type { AppRouter } from "@canvas/api";
import { TASK_PRIORITIES } from "@canvas/shared";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type Status = RouterOutputs["status"]["list"][number];
type Member = RouterOutputs["workspace"]["members"][number];

const PRIORITY_LABEL: Record<(typeof TASK_PRIORITIES)[number], string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export function TaskDetailPanel({
  taskId,
  workspaceId,
  onClose,
}: {
  taskId: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const task = trpc.task.get.useQuery({ taskId });
  const listId = task.data?.listId;

  const statuses = trpc.status.list.useQuery({ listId: listId ?? "" }, { enabled: !!listId });
  const members = trpc.workspace.members.useQuery({ workspaceId });

  const invalidate = () => {
    utils.task.get.invalidate({ taskId });
    if (listId) utils.task.list.invalidate({ listId });
  };
  const update = trpc.task.update.useMutation({ onSuccess: invalidate });
  const assign = trpc.task.assignees.add.useMutation({ onSuccess: invalidate });
  const unassign = trpc.task.assignees.remove.useMutation({ onSuccess: invalidate });

  const [title, setTitle] = useState("");
  const taskTitle = task.data?.title;
  useEffect(() => {
    if (taskTitle !== undefined) setTitle(taskTitle);
  }, [taskTitle]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close task details"
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />
      <div className="border-border bg-background relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground absolute top-4 right-4 text-sm"
        >
          ✕ Close
        </button>

        {task.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

        {task.data && (
          <div className="mt-8 space-y-6">
            <Input
              value={title}
              aria-label="Task title"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title.trim() && title.trim() !== task.data.title) {
                  update.mutate({ taskId, title: title.trim() });
                }
              }}
              className="h-auto border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            />

            <div className="grid grid-cols-2 gap-4">
              <Field label="Status">
                <select
                  value={task.data.statusId}
                  disabled={statuses.isLoading}
                  onChange={(e) => update.mutate({ taskId, statusId: e.target.value })}
                  className="border-border bg-background h-8 w-full rounded border text-sm"
                >
                  {(statuses.data ?? []).map((s: Status) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Priority">
                <select
                  value={task.data.priority ?? ""}
                  onChange={(e) =>
                    update.mutate({
                      taskId,
                      priority: e.target.value
                        ? (e.target.value as (typeof TASK_PRIORITIES)[number])
                        : null,
                    })
                  }
                  className="border-border bg-background h-8 w-full rounded border text-sm"
                >
                  <option value="">None</option>
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Start date">
                <Input
                  type="date"
                  value={task.data.startDate ?? ""}
                  onChange={(e) => update.mutate({ taskId, startDate: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </Field>

              <Field label="Due date">
                <Input
                  type="date"
                  value={task.data.dueDate ?? ""}
                  onChange={(e) => update.mutate({ taskId, dueDate: e.target.value || null })}
                  className="h-8 text-sm"
                />
              </Field>
            </div>

            <Field label="Assignees">
              <div className="flex flex-wrap items-center gap-2">
                {task.data.assignees.map((a) => (
                  <span
                    key={a.userId}
                    className="border-border flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                  >
                    {a.name}
                    <button
                      type="button"
                      aria-label={`Remove ${a.name}`}
                      onClick={() => unassign.mutate({ taskId, userId: a.userId })}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <select
                  value=""
                  aria-label="Assign someone"
                  onChange={(e) => {
                    if (e.target.value) assign.mutate({ taskId, userId: e.target.value });
                  }}
                  className="border-border bg-background h-7 rounded border text-xs"
                >
                  <option value="">+ Assign…</option>
                  {(members.data ?? [])
                    .filter((m: Member) => !task.data.assignees.some((a) => a.userId === m.userId))
                    .map((m: Member) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
            </Field>

            <Field label="Description">
              <DescriptionEditor
                key={task.data.id}
                initialContent={task.data.descriptionJson}
                onSave={(json) => update.mutate({ taskId, descriptionJson: json })}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function DescriptionEditor({
  initialContent,
  onSave,
}: {
  initialContent: unknown;
  onSave: (json: unknown) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: (initialContent as object | undefined) ?? "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-32 focus:outline-none",
        "aria-label": "Description",
      },
    },
    onBlur: ({ editor }) => onSave(editor.getJSON()),
  });

  // `content` above only seeds the editor on creation — TipTap doesn't
  // reactively apply prop changes. If the task query resolves with fresher
  // data after this editor already mounted (e.g. reopening the panel while
  // the previous close's cache invalidation is still in flight), sync it in
  // explicitly. Guarded by a content comparison so we don't clobber the
  // user's cursor position on every keystroke-triggered re-render.
  useEffect(() => {
    if (!editor || initialContent === undefined) return;
    const incoming = JSON.stringify(initialContent);
    if (JSON.stringify(editor.getJSON()) !== incoming) {
      editor.commands.setContent((initialContent as object) ?? "");
    }
  }, [editor, initialContent]);

  return (
    <div className="border-border rounded-md border p-2">
      <EditorContent editor={editor} />
    </div>
  );
}

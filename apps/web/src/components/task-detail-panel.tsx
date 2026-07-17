import type { AppRouter } from "@canvas/api";
import { TASK_PRIORITIES } from "@canvas/shared";
import { ActivitySection } from "@/components/activity-section";
import { CommentsSection } from "@/components/comments-section";
import { CustomFieldsSection } from "@/components/custom-fields-section";
import { Field, Section } from "@/components/detail-field";
import { TagsSection } from "@/components/tags-section";
import { Input } from "@/components/ui/input";
import { useOptimisticChecklistItemUpdate } from "@/hooks/use-checklist-mutations";
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
  onOpenTask,
}: {
  taskId: string;
  workspaceId: string;
  onClose: () => void;
  onOpenTask?: (taskId: string) => void;
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

            {!task.data.parentTaskId && (
              <SubtasksSection
                taskId={taskId}
                listId={task.data.listId}
                subtasks={task.data.subtasks}
                statuses={statuses.data ?? []}
                onChanged={invalidate}
                onOpenTask={onOpenTask}
              />
            )}

            <ChecklistsSection taskId={taskId} />

            <TagsSection
              taskId={taskId}
              workspaceId={workspaceId}
              tags={task.data.tags}
              onChanged={invalidate}
            />

            <CustomFieldsSection taskId={taskId} workspaceId={workspaceId} listId={task.data.listId} />

            <CommentsSection taskId={taskId} workspaceId={workspaceId} />

            <ActivitySection taskId={taskId} />
          </div>
        )}
      </div>
    </div>
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

type Subtask = RouterOutputs["task"]["get"]["subtasks"][number];

function SubtasksSection({
  taskId,
  listId,
  subtasks,
  statuses,
  onChanged,
  onOpenTask,
}: {
  taskId: string;
  listId: string;
  subtasks: Subtask[];
  statuses: Status[];
  onChanged: () => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const create = trpc.task.create.useMutation({
    onSuccess: () => {
      onChanged();
      setTitle("");
    },
  });
  const del = trpc.task.delete.useMutation({ onSuccess: onChanged });

  const statusName = (statusId: string) => statuses.find((s) => s.id === statusId)?.name ?? "";

  return (
    <Section label={`Subtasks${subtasks.length ? ` (${subtasks.length})` : ""}`}>
      <div className="space-y-1">
        {subtasks.map((s) => (
          <div
            key={s.id}
            className="group border-border flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
          >
            {onOpenTask ? (
              <button
                type="button"
                onClick={() => onOpenTask(s.id)}
                className="flex-1 truncate text-left hover:underline"
              >
                {s.title}
              </button>
            ) : (
              <span className="flex-1 truncate">{s.title}</span>
            )}
            <span className="text-muted-foreground shrink-0 text-xs">{statusName(s.statusId)}</span>
            <button
              type="button"
              aria-label={`Delete subtask ${s.title}`}
              onClick={() => del.mutate({ taskId: s.id })}
              className="text-muted-foreground hover:text-foreground hidden shrink-0 group-hover:inline"
            >
              ✕
            </button>
          </div>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate({ listId, parentTaskId: taskId, title: title.trim() });
          }}
        >
          <Input
            value={title}
            placeholder="+ Add subtask"
            aria-label="New subtask"
            onChange={(e) => setTitle(e.target.value)}
            className="h-7 text-xs"
          />
        </form>
      </div>
    </Section>
  );
}

function ChecklistsSection({ taskId }: { taskId: string }) {
  const utils = trpc.useUtils();
  const checklists = trpc.checklist.list.useQuery({ taskId });
  const invalidate = () => utils.checklist.list.invalidate({ taskId });

  const [name, setName] = useState("");
  const createChecklist = trpc.checklist.create.useMutation({
    onSuccess: () => {
      invalidate();
      setName("");
    },
  });
  const deleteChecklist = trpc.checklist.delete.useMutation({ onSuccess: invalidate });
  const createItem = trpc.checklist.items.create.useMutation({ onSuccess: invalidate });
  const updateItem = useOptimisticChecklistItemUpdate(taskId);
  const deleteItem = trpc.checklist.items.delete.useMutation({ onSuccess: invalidate });

  return (
    <Section label="Checklists">
      <div className="space-y-4">
        {(checklists.data ?? []).map((checklist) => {
          const doneCount = checklist.items.filter((i) => i.done).length;
          return (
            <div key={checklist.id} className="space-y-1">
              <div className="group flex items-center gap-2">
                <span className="text-sm font-medium">{checklist.name}</span>
                <span className="text-muted-foreground text-xs">
                  {doneCount}/{checklist.items.length}
                </span>
                <button
                  type="button"
                  aria-label={`Delete checklist ${checklist.name}`}
                  onClick={() => deleteChecklist.mutate({ checklistId: checklist.id })}
                  className="text-muted-foreground hover:text-foreground ml-auto hidden text-xs group-hover:inline"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1">
                {checklist.items.map((item) => (
                  <div key={item.id} className="group flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.done}
                      aria-label={item.text}
                      onChange={(e) =>
                        updateItem.mutate({ itemId: item.id, done: e.target.checked })
                      }
                    />
                    <span className={item.done ? "text-muted-foreground line-through" : ""}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete item ${item.text}`}
                      onClick={() => deleteItem.mutate({ itemId: item.id })}
                      className="text-muted-foreground hover:text-foreground ml-auto hidden group-hover:inline"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <NewChecklistItemForm
                isPending={createItem.isPending}
                onSubmit={(text) => createItem.mutate({ checklistId: checklist.id, text })}
              />
            </div>
          );
        })}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createChecklist.mutate({ taskId, name: name.trim() });
          }}
        >
          <Input
            value={name}
            placeholder="+ Add checklist"
            aria-label="New checklist name"
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs"
          />
        </form>
      </div>
    </Section>
  );
}

function NewChecklistItemForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) {
          onSubmit(text.trim());
          setText("");
        }
      }}
    >
      <Input
        value={text}
        placeholder="+ Add item"
        aria-label="New checklist item text"
        disabled={isPending}
        onChange={(e) => setText(e.target.value)}
        className="h-7 text-xs"
      />
    </form>
  );
}

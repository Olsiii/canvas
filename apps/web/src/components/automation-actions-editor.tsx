import { newActionDraft, type ActionDraft } from "@/components/automation-action-draft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASK_PRIORITIES, type AutomationActionType, type TaskPriority } from "@canvas/shared";

const ACTION_TYPE_LABELS: Record<AutomationActionType, string> = {
  set_priority: "Set priority",
  add_tag: "Add tag",
  post_comment: "Post comment",
  generate_image: "Generate image",
  slack_notify: "Notify Slack",
};

export function AutomationActionsEditor({
  actions,
  onChange,
  tags,
}: {
  actions: ActionDraft[];
  onChange: (actions: ActionDraft[]) => void;
  tags: { id: string; name: string }[];
}) {
  function update(index: number, patch: Partial<ActionDraft>) {
    onChange(actions.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function remove(index: number) {
    onChange(actions.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {actions.map((action, i) => (
        <div
          key={i}
          className="border-border flex flex-wrap items-center gap-2 rounded-md border p-2"
        >
          <select
            value={action.type}
            onChange={(e) => update(i, { type: e.target.value as AutomationActionType })}
            className="border-border bg-background h-8 rounded border text-sm"
            data-testid={`automation-action-type-${i}`}
          >
            {Object.entries(ACTION_TYPE_LABELS).map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>

          {action.type === "set_priority" && (
            <select
              value={action.priority}
              onChange={(e) => update(i, { priority: e.target.value as TaskPriority })}
              className="border-border bg-background h-8 rounded border text-sm"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}

          {action.type === "add_tag" && (
            <select
              value={action.tagId}
              onChange={(e) => update(i, { tagId: e.target.value })}
              className="border-border bg-background h-8 rounded border text-sm"
              data-testid={`automation-action-tag-${i}`}
            >
              <option value="">Select a tag…</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}

          {action.type === "post_comment" && (
            <Input
              value={action.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="Comment text"
              className="h-8 flex-1 text-sm"
              data-testid={`automation-action-text-${i}`}
            />
          )}

          {action.type === "generate_image" && (
            <Input
              value={action.prompt}
              onChange={(e) => update(i, { prompt: e.target.value })}
              placeholder="Prompt, e.g. A banner for {{title}}"
              className="h-8 flex-1 text-sm"
              data-testid={`automation-action-prompt-${i}`}
            />
          )}

          {action.type === "slack_notify" && (
            <>
              <Input
                value={action.webhookUrl}
                onChange={(e) => update(i, { webhookUrl: e.target.value })}
                placeholder="Slack Incoming Webhook URL"
                className="h-8 flex-1 text-sm"
                data-testid={`automation-action-webhook-url-${i}`}
              />
              <Input
                value={action.message}
                onChange={(e) => update(i, { message: e.target.value })}
                placeholder="Message, e.g. {{title}} shipped"
                className="h-8 flex-1 text-sm"
                data-testid={`automation-action-message-${i}`}
              />
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove(i)}
            aria-label={`Remove action ${i + 1}`}
            title={`Remove action ${i + 1}`}
          >
            ✕
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...actions, newActionDraft()])}
        data-testid="automation-add-action"
      >
        Add action
      </Button>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { useBrainStream } from "@/hooks/use-brain-stream";
import { trpc } from "@/lib/trpc";
import { useEffect, useState, type FormEvent } from "react";

function messageText(contentJson: unknown): string {
  if (!contentJson || typeof contentJson !== "object") return "";
  const text = (contentJson as { text?: unknown }).text;
  return typeof text === "string" ? text : "";
}

function toolCallNames(contentJson: unknown): string[] {
  if (!contentJson || typeof contentJson !== "object") return [];
  const calls = (contentJson as { toolCalls?: unknown }).toolCalls;
  if (!Array.isArray(calls)) return [];
  return calls
    .map((c) =>
      c && typeof c === "object" && typeof (c as { name?: unknown }).name === "string"
        ? (c as { name: string }).name
        : null,
    )
    .filter((n): n is string => !!n);
}

function toolResultLabel(contentJson: unknown): string {
  if (!contentJson || typeof contentJson !== "object") return "Tool result";
  const name = (contentJson as { name?: unknown }).name;
  return typeof name === "string" ? `Tool: ${name}` : "Tool result";
}

export function BrainChatPanel({
  workspaceId,
  contextType,
  contextId,
  onClose,
  onImageReady,
}: {
  workspaceId: string;
  contextType: "global" | "task" | "doc";
  contextId?: string;
  onClose: () => void;
  /** Doc Brain: insert a finished generation into the collaborative editor. */
  onImageReady?: (versionId: string) => void;
}) {
  const utils = trpc.useUtils();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [draft, setDraft] = useState("");
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  const getOrCreate = trpc.brain.getOrCreateConversation.useMutation({
    onSuccess: (conversation) => setConversationId(conversation.id),
  });

  useEffect(() => {
    getOrCreate.mutate({
      workspaceId,
      contextType,
      contextId: contextType === "global" ? undefined : contextId,
    });
    // Intentionally once per mount / context change — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-scoped
  }, [workspaceId, contextType, contextId]);

  const messages = trpc.brain.messages.list.useQuery(
    { conversationId: conversationId ?? "" },
    { enabled: !!conversationId },
  );

  const send = trpc.brain.messages.send.useMutation();

  useBrainStream(conversationId, {
    onDelta: (text) => {
      setStreamingText((prev) => prev + text);
      setStreamError(null);
    },
    onDone: () => {
      setStreamingText("");
      setStatusLine(null);
      setSending(false);
      void (async () => {
        if (conversationId) {
          await utils.brain.messages.list.invalidate({ conversationId });
          if (contextType === "task" && contextId) {
            await utils.attachment.list.invalidate({ taskId: contextId });
          }
        }
        setPendingUserText(null);
      })();
    },
    onError: (message) => {
      setStreamError(message);
      setStreamingText("");
      setStatusLine(null);
      setPendingUserText(null);
      setSending(false);
    },
    onToolStatus: (event) => {
      if (event.status === "running") setStatusLine(`Running ${event.name}…`);
      else if (event.status === "error")
        setStatusLine(`${event.name} failed${event.detail ? `: ${event.detail}` : ""}`);
      else setStatusLine(null);
    },
    onImageStatus: (event) => {
      if (event.status === "queued") setStatusLine("Image queued…");
      else if (event.status === "generating") setStatusLine("Generating image…");
      else if (event.status === "done") {
        setStatusLine("Image ready");
        if (event.versionId) onImageReady?.(event.versionId);
      } else if (event.status === "error")
        setStatusLine(event.message ?? "Image generation failed");
    },
  });

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !conversationId || sending) return;

    setDraft("");
    setPendingUserText(text);
    setStreamingText("");
    setStreamError(null);
    setStatusLine(null);
    setSending(true);

    try {
      await send.mutateAsync({ conversationId, text });
    } catch {
      setPendingUserText(null);
      setSending(false);
      setStreamError("Failed to send message.");
    }
  }

  const title =
    contextType === "task"
      ? "Brain — this task"
      : contextType === "doc"
        ? "Brain — this doc"
        : "Brain";

  const persistedMessages = messages.data ?? [];
  const pendingAlreadyPersisted =
    !!pendingUserText &&
    persistedMessages.some(
      (m) => m.role === "user" && messageText(m.contentJson) === pendingUserText,
    );
  const showPending = !!pendingUserText && !pendingAlreadyPersisted;

  return (
    <div data-testid="brain-chat-panel" className="fixed inset-0 z-[60] flex justify-end">
      <button
        type="button"
        aria-label="Close Brain chat"
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />
      <div className="border-border bg-background relative flex h-full w-full max-w-md flex-col border-l shadow-xl">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {getOrCreate.isPending && !conversationId && (
            <p className="text-muted-foreground text-sm">Opening conversation…</p>
          )}
          {getOrCreate.isError && (
            <p className="text-destructive text-sm">Could not open Brain chat.</p>
          )}

          {persistedMessages.map((m) => {
            if (m.role === "tool") {
              return (
                <div
                  key={m.id}
                  data-testid="brain-message-tool"
                  className="text-muted-foreground mr-6 text-xs italic"
                >
                  {toolResultLabel(m.contentJson)}
                </div>
              );
            }

            const text = messageText(m.contentJson);
            const tools = toolCallNames(m.contentJson);
            if (!text && tools.length === 0) return null;

            return (
              <div
                key={m.id}
                data-testid={`brain-message-${m.role}`}
                className={
                  m.role === "user"
                    ? "bg-muted ml-6 rounded-md px-3 py-2 text-sm"
                    : "border-border mr-6 rounded-md border px-3 py-2 text-sm"
                }
              >
                <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">
                  {m.role === "user" ? "You" : "Brain"}
                </p>
                {text && <p className="whitespace-pre-wrap">{text}</p>}
                {tools.length > 0 && (
                  <p className="text-muted-foreground mt-1 text-xs">Used {tools.join(", ")}</p>
                )}
              </div>
            );
          })}

          {showPending && (
            <div
              data-testid="brain-message-user-pending"
              className="bg-muted ml-6 rounded-md px-3 py-2 text-sm opacity-80"
            >
              <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">You</p>
              <p className="whitespace-pre-wrap">{pendingUserText}</p>
            </div>
          )}

          {(streamingText || (sending && !streamingText) || statusLine) && (
            <div
              data-testid="brain-message-assistant-streaming"
              className="border-border mr-6 rounded-md border px-3 py-2 text-sm"
            >
              <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">
                Brain
              </p>
              {statusLine && (
                <p data-testid="brain-status-line" className="text-muted-foreground mb-1 text-xs">
                  {statusLine}
                </p>
              )}
              <p className="whitespace-pre-wrap">
                {streamingText || (sending && !statusLine ? "…" : "")}
              </p>
            </div>
          )}

          {streamError && (
            <p className="text-destructive text-sm" role="alert">
              {streamError}
            </p>
          )}
        </div>

        <form onSubmit={handleSend} className="border-border border-t p-3">
          <label className="sr-only" htmlFor="brain-message-input">
            Message Brain
          </label>
          <textarea
            id="brain-message-input"
            data-testid="brain-message-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask Brain…"
            rows={3}
            disabled={!conversationId || sending}
            className="border-border focus-visible:ring-primary mb-2 w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend(e);
              }
            }}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!conversationId || sending || !draft.trim()}>
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

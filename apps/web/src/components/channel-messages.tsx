import type { AppRouter } from "@canvas/api";
import { BlurhashThumb } from "@/components/blurhash-thumb";
import { Lightbox } from "@/components/lightbox";
import type { MentionCandidate } from "@/components/mention-list";
import { Button } from "@/components/ui/button";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { useSession } from "@/hooks/use-session";
import { Avatar } from "@/lib/avatar";
import { shouldStartNewGroup } from "@/lib/chat-grouping";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { createMentionExtension } from "@/lib/mention-extension";
import { trpc } from "@/lib/trpc";
import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { inferRouterOutputs } from "@trpc/server";
import { CornerDownRight, Download, Paperclip, Send, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ChatMessage = RouterOutputs["chat"]["message"]["list"][number];
type MessageAttachment = ChatMessage["attachments"][number];

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

function isEmptyDoc(json: unknown): boolean {
  const doc = json as { content?: { content?: unknown[] }[] } | undefined;
  return !doc?.content?.some((node) => (node.content?.length ?? 0) > 0);
}

export function ChannelMessages({
  channelId,
  workspaceId,
}: {
  channelId: string;
  workspaceId: string;
}) {
  const utils = trpc.useUtils();
  const { user } = useSession();
  const messages = trpc.chat.message.list.useQuery({ channelId });
  const members = trpc.workspace.members.useQuery({ workspaceId });

  const invalidate = () => utils.chat.message.list.invalidate({ channelId });
  const createMessage = trpc.chat.message.create.useMutation();
  const deleteMessage = trpc.chat.message.delete.useMutation({ onSuccess: invalidate });

  const candidatesRef = useRef<MentionCandidate[]>([]);
  useEffect(() => {
    candidatesRef.current = (members.data ?? []).map((m) => ({ id: m.userId, label: m.name }));
  }, [members.data]);

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: MessageAttachment[]; index: number } | null>(
    null,
  );

  // The message must exist before a file can be tagged with its id — send
  // the message first, then upload each selected file against the new id,
  // then refresh. See attachments-section.tsx for the same /uploads
  // multipart pattern (tRPC has no file-upload transport).
  async function sendWithFiles(bodyJson: unknown, files: File[], parentMessageId?: string) {
    const message = await createMessage.mutateAsync({ channelId, parentMessageId, bodyJson });
    for (const file of files) {
      const form = new FormData();
      form.append("messageId", message.id);
      form.append("file", file);
      await fetch("/uploads", { method: "POST", body: form, credentials: "include" });
    }
    invalidate();
  }

  const all = messages.data ?? [];
  const topLevel = all.filter((m) => !m.parentMessageId);
  const repliesByParent = new Map<string, ChatMessage[]>();
  for (const m of all) {
    if (!m.parentMessageId) continue;
    const list = repliesByParent.get(m.parentMessageId) ?? [];
    list.push(m);
    repliesByParent.set(m.parentMessageId, list);
  }

  const threadParent = openThreadId ? all.find((m) => m.id === openThreadId) : undefined;
  const threadReplies = openThreadId ? (repliesByParent.get(openThreadId) ?? []) : [];
  const threadOpen = !!(openThreadId && threadParent);
  const { containerRef: threadPanelRef, onKeyDown: threadPanelOnKeyDown } = useModalA11y(
    () => setOpenThreadId(null),
    threadOpen,
  );

  return (
    <>
      <div className="flex h-full flex-col" data-testid="channel-messages">
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {topLevel.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No messages yet — say something to get the conversation going.
            </p>
          ) : (
            topLevel.map((message, i) => {
              const prev = topLevel[i - 1];
              const newGroup = shouldStartNewGroup(
                prev ? { authorId: prev.authorId, createdAt: prev.createdAt } : undefined,
                { authorId: message.authorId, createdAt: message.createdAt },
              );
              const replies = repliesByParent.get(message.id) ?? [];
              const lastReply = replies.at(-1);

              return (
                <div key={message.id}>
                  <MessageRow
                    message={message}
                    compact={!newGroup}
                    canDelete={message.authorId === user?.id}
                    onDelete={() => deleteMessage.mutate({ messageId: message.id })}
                    onReply={() => setOpenThreadId(message.id)}
                    onOpenImage={(images, index) => setLightbox({ images, index })}
                  />
                  {lastReply && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenThreadId(message.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setOpenThreadId(message.id);
                      }}
                      className="text-muted-foreground hover:text-foreground ml-10 flex cursor-pointer items-center gap-1.5 text-xs"
                    >
                      <CornerDownRight className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="text-accent font-medium">
                        {replies.length} {replies.length === 1 ? "reply" : "replies"}
                      </span>
                      <span className="truncate">
                        {lastReply.author.name}: {plainTextPreview(lastReply.bodyJson)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-border shrink-0 border-t p-2">
          <MessageComposer
            candidatesRef={candidatesRef}
            placeholder="Message this channel… use @ to mention"
            isPending={createMessage.isPending}
            onSubmit={(bodyJson, files) => void sendWithFiles(bodyJson, files)}
          />
        </div>

        {lightbox && (
          <Lightbox
            images={lightbox.images}
            index={lightbox.index}
            onClose={() => setLightbox(null)}
            onIndexChange={(index) => setLightbox({ images: lightbox.images, index })}
          />
        )}
      </div>

      {openThreadId && threadParent && (
        <div data-testid="thread-panel" className="fixed inset-0 z-[60] flex justify-end">
          <button
            type="button"
            aria-label="Close thread"
            title="Close thread"
            className="absolute inset-0 bg-black/20"
            onClick={() => setOpenThreadId(null)}
          />
          <div
            ref={threadPanelRef}
            onKeyDown={threadPanelOnKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Thread"
            tabIndex={-1}
            className="border-border bg-background relative flex h-full w-full max-w-md flex-col border-l shadow-xl outline-none"
          >
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Thread</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpenThreadId(null)}
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <MessageRow
                message={threadParent}
                canDelete={threadParent.authorId === user?.id}
                onDelete={() => {
                  deleteMessage.mutate({ messageId: threadParent.id });
                  setOpenThreadId(null);
                }}
                onOpenImage={(images, index) => setLightbox({ images, index })}
              />
              {threadReplies.length > 0 && (
                <div className="border-border space-y-3 border-t pt-3">
                  {threadReplies.map((reply) => (
                    <MessageRow
                      key={reply.id}
                      message={reply}
                      canDelete={reply.authorId === user?.id}
                      onDelete={() => deleteMessage.mutate({ messageId: reply.id })}
                      onOpenImage={(images, index) => setLightbox({ images, index })}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-border shrink-0 border-t p-2">
              <MessageComposer
                candidatesRef={candidatesRef}
                placeholder="Write a reply…"
                autoFocus
                isPending={createMessage.isPending}
                onSubmit={(bodyJson, files) => void sendWithFiles(bodyJson, files, openThreadId)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Plain-text extraction for the thread preview line — a lightweight
// alternative to mounting a whole TipTap editor per row just to show a
// one-line snippet of the last reply.
function plainTextPreview(bodyJson: unknown): string {
  const doc = bodyJson as { content?: { content?: { text?: string }[] }[] } | undefined;
  const text = (doc?.content ?? [])
    .flatMap((node) => node.content ?? [])
    .map((node) => node.text ?? "")
    .join(" ")
    .trim();
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function MessageRow({
  message,
  compact,
  canDelete,
  onDelete,
  onReply,
  onOpenImage,
}: {
  message: ChatMessage;
  compact?: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onReply?: () => void;
  onOpenImage: (images: MessageAttachment[], index: number) => void;
}) {
  const images = message.attachments.filter((a) => a.mime.startsWith("image/"));
  const files = message.attachments.filter((a) => !a.mime.startsWith("image/"));

  return (
    <div
      className="group flex gap-2.5 rounded px-2 py-0.5 hover:bg-muted/40"
      data-testid={`message-${message.id}`}
    >
      {compact ? (
        <span className="w-8 shrink-0" aria-hidden />
      ) : (
        <Avatar name={message.author.name} avatarUrl={message.author.avatarUrl} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {!compact && <span className="text-sm font-medium">{message.author.name}</span>}
          <span
            className={`text-muted-foreground text-xs ${compact ? "opacity-0 group-hover:opacity-100" : ""}`}
          >
            {formatRelativeTime(new Date(message.createdAt))}
          </span>
          <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100">
            {onReply && (
              <button
                type="button"
                onClick={onReply}
                aria-label="Reply"
                title="Reply"
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
              >
                <CornerDownRight className="h-3.5 w-3.5" aria-hidden />
                Reply
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                aria-label="Delete message"
                title="Delete message"
                onClick={onDelete}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>
        <MessageBody bodyJson={message.bodyJson} />

        {images.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {images.map((a, i) => (
              <div key={a.id} className="group/thumb relative">
                <BlurhashThumb attachment={a} onClick={() => onOpenImage(images, i)} />
                <a
                  href={`/uploads/${a.id}?download=1`}
                  download
                  aria-label={`Download ${a.fileName}`}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-background/90 text-muted-foreground hover:text-foreground absolute top-1 right-1 hidden rounded-full p-1 group-hover/thumb:inline-flex"
                >
                  <Download className="h-3 w-3" aria-hidden />
                </a>
              </div>
            ))}
          </div>
        )}
        {files.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {files.map((a) => (
              <div
                key={a.id}
                className="border-border hover:bg-muted flex max-w-xs items-center gap-2 rounded-md border px-2 py-1 text-xs"
              >
                <a
                  href={`/uploads/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <Paperclip className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="flex-1 truncate">{a.fileName}</span>
                  <span className="text-muted-foreground shrink-0">
                    {formatBytes(a.sizeBytes ?? 0)}
                  </span>
                </a>
                <a
                  href={`/uploads/${a.id}?download=1`}
                  download
                  aria-label={`Download ${a.fileName}`}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBody({ bodyJson }: { bodyJson: unknown }) {
  const editor = useEditor({
    editable: false,
    extensions: [StarterKit, Mention],
    content: (bodyJson as object | undefined) ?? "",
    editorProps: { attributes: { class: "prose prose-sm dark:prose-invert max-w-none" } },
  });
  return <EditorContent editor={editor} />;
}

function MessageComposer({
  candidatesRef,
  placeholder,
  autoFocus,
  isPending,
  onSubmit,
}: {
  candidatesRef: React.RefObject<MentionCandidate[]>;
  placeholder: string;
  autoFocus?: boolean;
  isPending: boolean;
  onSubmit: (bodyJson: unknown, files: File[]) => void;
}) {
  const [extensions] = useState(() => [StarterKit, createMentionExtension(candidatesRef)]);
  const editor = useEditor({
    extensions,
    content: EMPTY_DOC,
    autofocus: autoFocus ?? false,
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none min-h-12 focus:outline-none",
        "aria-label": placeholder,
        "data-testid": "message-composer",
      },
    },
  });

  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    if (!editor) return;
    const update = () => setEmpty(isEmptyDoc(editor.getJSON()));
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  function handleSend() {
    if (!editor) return;
    onSubmit(editor.getJSON(), pendingFiles);
    editor.commands.clearContent();
    setEmpty(true);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div
      data-testid="message-composer-dropzone"
      className={`border-border bg-card rounded-md border p-2.5 transition-colors ${dragging ? "border-accent bg-accent-soft" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const dropped = Array.from(e.dataTransfer.files ?? []);
        if (dropped.length > 0) setPendingFiles((prev) => [...prev, ...dropped]);
      }}
    >
      <EditorContent editor={editor} />
      {dragging && (
        <p className="text-accent pointer-events-none py-1 text-center text-xs font-medium">
          Drop to attach
        </p>
      )}

      {pendingFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pendingFiles.map((file, i) => (
            <span
              key={`${file.name}-${i}`}
              className="bg-muted flex items-center gap-1 rounded px-2 py-0.5 text-xs"
            >
              <Paperclip className="h-3 w-3" aria-hidden />
              {file.name}
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                title={`Remove ${file.name}`}
                onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          aria-label="Attach a file"
          className="hidden"
          onChange={(e) =>
            setPendingFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])
          }
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Choose a file to attach"
          title="Choose a file to attach"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          data-testid="message-send"
          disabled={empty || isPending}
          onClick={handleSend}
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          Send
        </Button>
      </div>
    </div>
  );
}

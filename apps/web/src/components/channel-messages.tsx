import type { AppRouter } from "@canvas/api";
import type { MentionCandidate } from "@/components/mention-list";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { formatRelativeTime } from "@/lib/format";
import { createMentionExtension } from "@/lib/mention-extension";
import { trpc } from "@/lib/trpc";
import Mention from "@tiptap/extension-mention";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useRef, useState } from "react";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ChatMessage = RouterOutputs["chat"]["message"]["list"][number];

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
  const createMessage = trpc.chat.message.create.useMutation({ onSuccess: invalidate });
  const deleteMessage = trpc.chat.message.delete.useMutation({ onSuccess: invalidate });

  const candidatesRef = useRef<MentionCandidate[]>([]);
  useEffect(() => {
    candidatesRef.current = (members.data ?? []).map((m) => ({ id: m.userId, label: m.name }));
  }, [members.data]);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const all = messages.data ?? [];
  const topLevel = all.filter((m) => !m.parentMessageId);
  const repliesByParent = new Map<string, ChatMessage[]>();
  for (const m of all) {
    if (!m.parentMessageId) continue;
    const list = repliesByParent.get(m.parentMessageId) ?? [];
    list.push(m);
    repliesByParent.set(m.parentMessageId, list);
  }

  return (
    <div className="space-y-3" data-testid="channel-messages">
      {topLevel.length === 0 ? (
        <p className="text-muted-foreground text-sm">No messages yet. Say something.</p>
      ) : (
        topLevel.map((message) => (
          <div key={message.id} className="space-y-2">
            <MessageRow
              message={message}
              canDelete={message.authorId === user?.id}
              onDelete={() => deleteMessage.mutate({ messageId: message.id })}
              onReply={() => setReplyingTo(replyingTo === message.id ? null : message.id)}
            />
            {(repliesByParent.get(message.id) ?? []).map((reply) => (
              <div key={reply.id} className="ml-6">
                <MessageRow
                  message={reply}
                  canDelete={reply.authorId === user?.id}
                  onDelete={() => deleteMessage.mutate({ messageId: reply.id })}
                />
              </div>
            ))}
            {replyingTo === message.id && (
              <div className="ml-6">
                <MessageComposer
                  candidatesRef={candidatesRef}
                  placeholder="Write a reply…"
                  autoFocus
                  isPending={createMessage.isPending}
                  onSubmit={(bodyJson) => {
                    createMessage.mutate({ channelId, parentMessageId: message.id, bodyJson });
                    setReplyingTo(null);
                  }}
                />
              </div>
            )}
          </div>
        ))
      )}

      <MessageComposer
        candidatesRef={candidatesRef}
        placeholder="Message this channel… use @ to mention"
        isPending={createMessage.isPending}
        onSubmit={(bodyJson) => createMessage.mutate({ channelId, bodyJson })}
      />
    </div>
  );
}

function MessageRow({
  message,
  canDelete,
  onDelete,
  onReply,
}: {
  message: ChatMessage;
  canDelete: boolean;
  onDelete: () => void;
  onReply?: () => void;
}) {
  return (
    <div
      className="group border-border rounded-md border p-2"
      data-testid={`message-${message.id}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{message.author.name}</span>
        <span className="text-muted-foreground text-xs">
          {formatRelativeTime(new Date(message.createdAt))}
        </span>
        <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100">
          {onReply && (
            <button type="button" onClick={onReply} className="text-muted-foreground text-xs">
              Reply
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              aria-label="Delete message"
              onClick={onDelete}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <MessageBody bodyJson={message.bodyJson} />
    </div>
  );
}

function MessageBody({ bodyJson }: { bodyJson: unknown }) {
  const editor = useEditor({
    editable: false,
    extensions: [StarterKit, Mention],
    content: (bodyJson as object | undefined) ?? "",
    editorProps: { attributes: { class: "prose prose-sm max-w-none" } },
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
  onSubmit: (bodyJson: unknown) => void;
}) {
  const [extensions] = useState(() => [StarterKit, createMentionExtension(candidatesRef)]);
  const editor = useEditor({
    extensions,
    content: EMPTY_DOC,
    autofocus: autoFocus ?? false,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-16 focus:outline-none",
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

  return (
    <div className="border-border rounded-md border p-2">
      <EditorContent editor={editor} />
      <div className="mt-1 flex justify-end">
        <Button
          type="button"
          size="sm"
          className="h-6 px-2 text-xs"
          data-testid="message-send"
          disabled={empty || isPending}
          onClick={() => {
            if (!editor) return;
            onSubmit(editor.getJSON());
            editor.commands.clearContent();
            setEmpty(true);
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
}

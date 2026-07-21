import type { AppRouter } from "@canvas/api";
import { REACTION_EMOJIS, type ReactionEmoji } from "@canvas/shared";
import { Section } from "@/components/detail-field";
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
type Comment = RouterOutputs["comment"]["list"][number];

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

function isEmptyDoc(json: unknown): boolean {
  const doc = json as { content?: { content?: unknown[] }[] } | undefined;
  return !doc?.content?.some((node) => (node.content?.length ?? 0) > 0);
}

export function CommentsSection({ taskId, workspaceId }: { taskId: string; workspaceId: string }) {
  const utils = trpc.useUtils();
  const { user } = useSession();
  const comments = trpc.comment.list.useQuery({ taskId });
  const members = trpc.workspace.members.useQuery({ workspaceId });

  const invalidate = () => utils.comment.list.invalidate({ taskId });
  const createComment = trpc.comment.create.useMutation({ onSuccess: invalidate });
  const deleteComment = trpc.comment.delete.useMutation({ onSuccess: invalidate });
  const addReaction = trpc.comment.reactions.add.useMutation({ onSuccess: invalidate });
  const removeReaction = trpc.comment.reactions.remove.useMutation({ onSuccess: invalidate });

  const candidatesRef = useRef<MentionCandidate[]>([]);
  useEffect(() => {
    candidatesRef.current = (members.data ?? []).map((m) => ({ id: m.userId, label: m.name }));
  }, [members.data]);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const all = comments.data ?? [];
  const topLevel = all.filter((c) => !c.parentCommentId);
  const repliesByParent = new Map<string, Comment[]>();
  for (const c of all) {
    if (!c.parentCommentId) continue;
    const list = repliesByParent.get(c.parentCommentId) ?? [];
    list.push(c);
    repliesByParent.set(c.parentCommentId, list);
  }

  const toggleReaction = (commentId: string, emoji: ReactionEmoji, reactedByMe: boolean) => {
    if (reactedByMe) removeReaction.mutate({ commentId, emoji });
    else addReaction.mutate({ commentId, emoji });
  };

  return (
    <Section label={`Comments${all.length ? ` (${all.length})` : ""}`}>
      <div className="space-y-3">
        {topLevel.map((comment) => (
          <div key={comment.id} className="space-y-2">
            <CommentRow
              comment={comment}
              canDelete={comment.authorId === user?.id}
              onDelete={() => deleteComment.mutate({ commentId: comment.id })}
              onReply={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              onToggleReaction={(emoji, reactedByMe) =>
                toggleReaction(comment.id, emoji, reactedByMe)
              }
            />
            {(repliesByParent.get(comment.id) ?? []).map((reply) => (
              <div key={reply.id} className="ml-6">
                <CommentRow
                  comment={reply}
                  canDelete={reply.authorId === user?.id}
                  onDelete={() => deleteComment.mutate({ commentId: reply.id })}
                  onToggleReaction={(emoji, reactedByMe) =>
                    toggleReaction(reply.id, emoji, reactedByMe)
                  }
                />
              </div>
            ))}
            {replyingTo === comment.id && (
              <div className="ml-6">
                <CommentComposer
                  candidatesRef={candidatesRef}
                  placeholder="Write a reply…"
                  autoFocus
                  isPending={createComment.isPending}
                  onSubmit={(bodyJson) => {
                    createComment.mutate({ taskId, parentCommentId: comment.id, bodyJson });
                    setReplyingTo(null);
                  }}
                />
              </div>
            )}
          </div>
        ))}

        <CommentComposer
          candidatesRef={candidatesRef}
          placeholder="Write a comment… use @ to mention"
          isPending={createComment.isPending}
          onSubmit={(bodyJson) => createComment.mutate({ taskId, bodyJson })}
        />
      </div>
    </Section>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
  onReply,
  onToggleReaction,
}: {
  comment: Comment;
  canDelete: boolean;
  onDelete: () => void;
  onReply?: () => void;
  onToggleReaction: (emoji: ReactionEmoji, reactedByMe: boolean) => void;
}) {
  return (
    <div className="group border-border rounded-md border p-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{comment.author.name}</span>
        <span className="text-muted-foreground text-xs">
          {formatRelativeTime(new Date(comment.createdAt))}
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
              aria-label="Delete comment"
              onClick={onDelete}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <CommentBody bodyJson={comment.bodyJson} />
      <div className="mt-1 flex gap-1">
        {REACTION_EMOJIS.map((emoji) => {
          const entry = comment.reactions.find((r) => r.emoji === emoji);
          return (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              onClick={() => onToggleReaction(emoji, entry?.reactedByMe ?? false)}
              className={`rounded px-1 text-xs ${
                entry?.reactedByMe ? "bg-muted" : "hover:bg-muted"
              }`}
            >
              {emoji}
              {entry ? ` ${entry.count}` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CommentBody({ bodyJson }: { bodyJson: unknown }) {
  const editor = useEditor({
    editable: false,
    // Mention (unconfigured — no suggestion behavior needed for read-only
    // display) must be registered here too, or the schema doesn't know the
    // "mention" node type and silently drops any comment that has one.
    extensions: [StarterKit, Mention],
    content: (bodyJson as object | undefined) ?? "",
    editorProps: { attributes: { class: "prose prose-sm max-w-none" } },
  });
  return <EditorContent editor={editor} />;
}

function CommentComposer({
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
          disabled={empty || isPending}
          onClick={() => {
            if (!editor) return;
            onSubmit(editor.getJSON());
            editor.commands.clearContent();
            setEmpty(true);
          }}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}

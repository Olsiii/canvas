import { BrainChatPanel } from "@/components/brain-chat-panel";
import { insertImageVersionIntoEditor } from "@/components/doc-image-insert";
import { DocTaskLinks } from "@/components/doc-task-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { createRoute, Link } from "@tanstack/react-router";
import type { Editor } from "@tiptap/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { workspaceShellRoute } from "./workspace.$workspaceId";

// Lazy: this is the one component that pulls in Yjs/y-websocket and the
// TipTap collaboration extensions — real weight (see PROGRESS.md's
// performance-hardening decisions) worth deferring until someone actually
// opens a doc, rather than shipping it in the app's main bundle.
const DocCollaborativeEditor = lazy(() =>
  import("@/components/doc-collaborative-editor").then((m) => ({
    default: m.DocCollaborativeEditor,
  })),
);

export const docEditorRoute = createRoute({
  getParentRoute: () => workspaceShellRoute,
  path: "/docs/$docId",
  component: DocEditorPage,
});

function DocEditorPage() {
  const { workspaceId, docId } = docEditorRoute.useParams();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const doc = trpc.doc.get.useQuery({ docId });
  const update = trpc.doc.update.useMutation({
    onSuccess: () => {
      void utils.doc.get.invalidate({ docId });
      void utils.doc.list.invalidate({ workspaceId });
    },
  });
  const [title, setTitle] = useState("");
  const [brainOpen, setBrainOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (doc.data?.title) setTitle(doc.data.title);
  }, [doc.data?.title]);

  if (doc.isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading…</p>;
  }

  if (!doc.data) {
    return (
      <div className="space-y-2 p-6">
        <p className="text-muted-foreground text-sm">Doc not found.</p>
        <Link to="/w/$workspaceId/docs" params={{ workspaceId }} className="text-sm underline">
          Back to Docs
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6" data-testid="doc-editor-page">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/w/$workspaceId/docs"
          params={{ workspaceId }}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          ← Docs
        </Link>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="doc-copy-text"
            onClick={() => {
              const text = editorRef.current?.getText() ?? "";
              void navigator.clipboard.writeText(text);
              setCopiedText(true);
              setTimeout(() => setCopiedText(false), 1500);
            }}
          >
            {copiedText ? "Copied" : "Copy text"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="doc-copy-link"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 1500);
            }}
          >
            {copiedLink ? "Copied" : "Copy link"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="doc-ask-brain"
            aria-label="Ask Brain about this doc"
            title="Ask Brain about this doc"
            onClick={() => setBrainOpen(true)}
          >
            Ask Brain
          </Button>
        </div>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = title.trim();
          if (next && next !== doc.data.title) {
            update.mutate({ docId, title: next });
          }
        }}
      >
        <Input
          data-testid="doc-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 text-lg font-semibold"
          aria-label="Doc title"
        />
        <Button type="submit" size="sm" variant="outline" disabled={update.isPending}>
          Save title
        </Button>
      </form>

      <DocTaskLinks docId={docId} workspaceId={workspaceId} />

      <Suspense fallback={<p className="text-muted-foreground p-6 text-sm">Loading editor…</p>}>
        <DocCollaborativeEditor
          docId={docId}
          userName={me.data?.name ?? me.data?.email ?? "Someone"}
          onEditorReady={(editor) => {
            editorRef.current = editor;
          }}
        />
      </Suspense>

      {brainOpen && (
        <BrainChatPanel
          workspaceId={workspaceId}
          contextType="doc"
          contextId={docId}
          onClose={() => setBrainOpen(false)}
          onImageReady={(versionId) => {
            const editor = editorRef.current;
            if (editor) insertImageVersionIntoEditor(editor, versionId);
          }}
        />
      )}
    </div>
  );
}

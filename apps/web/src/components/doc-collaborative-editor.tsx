import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

const CARET_COLORS = ["#e11d48", "#2563eb", "#059669", "#d97706", "#7c3aed"];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CARET_COLORS[hash % CARET_COLORS.length]!;
}

function docsWsBaseUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/docs`;
}

type CollabEntry = {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  refCount: number;
  destroyTimer: ReturnType<typeof setTimeout> | null;
};

// Module-level pool so React Strict Mode remounts reuse the same socket
// instead of close/reopen (Vite's /ws proxy ECONNRESETs on that churn and
// then fails to deliver binary sync frames for later connections).
const collabPool = new Map<string, CollabEntry>();

function acquireCollab(docId: string): CollabEntry {
  const existing = collabPool.get(docId);
  if (existing) {
    if (existing.destroyTimer) {
      clearTimeout(existing.destroyTimer);
      existing.destroyTimer = null;
    }
    existing.refCount += 1;
    return existing;
  }

  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(docsWsBaseUrl(), docId, ydoc, {
    connect: true,
    disableBc: true,
  });
  const entry: CollabEntry = { ydoc, provider, refCount: 1, destroyTimer: null };
  collabPool.set(docId, entry);
  return entry;
}

function releaseCollab(docId: string) {
  const entry = collabPool.get(docId);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount > 0) return;
  entry.destroyTimer = setTimeout(() => {
    if (entry.refCount > 0) return;
    entry.provider.destroy();
    entry.ydoc.destroy();
    collabPool.delete(docId);
  }, 500);
}

function DocEditorSurface({
  ydoc,
  provider,
  userName,
  editable,
  onEditorReady,
}: {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  userName: string;
  editable: boolean;
  onEditorReady?: (editor: Editor | null) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false,
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "max-w-full rounded-md",
          "data-testid": "doc-inline-image",
        },
      }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({
        provider,
        user: { name: userName, color: colorForName(userName) },
      }),
    ],
    editable,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[50vh] focus:outline-none px-1 py-2",
        "data-testid": "doc-editor",
      },
    },
  });

  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  useEffect(() => {
    onEditorReadyRef.current?.(editor);
    return () => onEditorReadyRef.current?.(null);
  }, [editor]);

  return <EditorContent editor={editor} />;
}

export function DocCollaborativeEditor({
  docId,
  userName,
  editable = true,
  onEditorReady,
}: {
  docId: string;
  userName: string;
  editable?: boolean;
  onEditorReady?: (editor: Editor | null) => void;
}) {
  const [synced, setSynced] = useState(false);
  const [collab, setCollab] = useState<{
    ydoc: Y.Doc;
    provider: WebsocketProvider;
  } | null>(null);

  useEffect(() => {
    const entry = acquireCollab(docId);
    const { ydoc, provider } = entry;

    const onSync = (isSynced: boolean) => setSynced(!!isSynced);
    const onStatus = (event: { status: string }) => {
      if (event.status === "connected" && provider.synced) setSynced(true);
    };
    provider.on("sync", onSync);
    provider.on("status", onStatus);
    if (provider.synced) setSynced(true);

    setCollab({ ydoc, provider });

    return () => {
      provider.off("sync", onSync);
      provider.off("status", onStatus);
      setCollab(null);
      setSynced(false);
      releaseCollab(docId);
    };
  }, [docId]);

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs" data-testid="doc-sync-status">
        {synced ? "Synced" : "Connecting…"}
      </p>
      <div className="border-border min-h-[50vh] rounded-md border px-3 py-2">
        {collab ? (
          <DocEditorSurface
            key={docId}
            ydoc={collab.ydoc}
            provider={collab.provider}
            userName={userName}
            editable={editable}
            onEditorReady={onEditorReady}
          />
        ) : null}
      </div>
    </div>
  );
}

export function insertImageVersionIntoEditor(editor: Editor, versionId: string) {
  editor
    .chain()
    .focus("end")
    .setImage({ src: `/image-versions/${versionId}` })
    .createParagraphNear()
    .run();
}

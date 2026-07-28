import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Quote, Strikethrough } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

const FONT_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Sans", value: "Arial, Helvetica, sans-serif" },
  { label: "Monospace", value: "'Courier New', monospace" },
];

const HEADING_OPTIONS = [
  { label: "Paragraph", value: "paragraph" },
  { label: "Heading 1", value: "1" },
  { label: "Heading 2", value: "2" },
  { label: "Heading 3", value: "3" },
];

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
        active ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function DocToolbar({ editor }: { editor: Editor | null }) {
  // TipTap's editor object doesn't itself trigger React re-renders when
  // selection/marks change — useEditorState subscribes to its transactions
  // and only re-renders when the derived snapshot actually changes value,
  // so every active-state check below stays live as the cursor moves.
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const e = ctx.editor;
      if (!e) return null;
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        strike: e.isActive("strike"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        blockquote: e.isActive("blockquote"),
        heading: e.isActive("heading", { level: 1 })
          ? "1"
          : e.isActive("heading", { level: 2 })
            ? "2"
            : e.isActive("heading", { level: 3 })
              ? "3"
              : "paragraph",
        fontFamily: (e.getAttributes("textStyle").fontFamily as string | undefined) ?? "",
      };
    },
  });

  if (!editor || !state) return null;

  return (
    <div
      className="border-border bg-muted/40 mb-2 flex flex-wrap items-center gap-1 rounded-md border p-1"
      data-testid="doc-toolbar"
    >
      <select
        value={state.heading}
        aria-label="Text style"
        data-testid="doc-toolbar-heading"
        onChange={(e) => {
          const value = e.target.value;
          const chain = editor.chain().focus();
          if (value === "paragraph") chain.setParagraph().run();
          else chain.toggleHeading({ level: Number(value) as 1 | 2 | 3 }).run();
        }}
        className="border-border bg-background h-7 rounded border text-xs"
      >
        {HEADING_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={state.fontFamily}
        aria-label="Font"
        data-testid="doc-toolbar-font"
        onChange={(e) => {
          const value = e.target.value;
          if (value) editor.chain().focus().setFontFamily(value).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        className="border-border bg-background h-7 rounded border text-xs"
      >
        {FONT_OPTIONS.map((o) => (
          <option key={o.label} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="bg-border mx-0.5 h-5 w-px" />

      <ToolbarButton
        label="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-3.5 w-3.5" aria-hidden />
      </ToolbarButton>

      <div className="bg-border mx-0.5 h-5 w-px" />

      <ToolbarButton
        label="Bullet list"
        active={state.bulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.orderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={state.blockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" aria-hidden />
      </ToolbarButton>
    </div>
  );
}

const CARET_COLORS = ["#e11d48", "#2563eb", "#059669", "#d97706", "#7c3aed"];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CARET_COLORS[hash % CARET_COLORS.length]!;
}

function docsWsBaseUrl() {
  // Vite's dev-server `/ws` proxy is prone to wedging under concurrent WS
  // churn (multiple docs' sockets opening/closing across parallel e2e
  // workers) — traced via server-side timing logs showing the API/DB side
  // consistently resolving in single-digit ms even under full-suite load,
  // which points the remaining multi-second stalls at the proxy hop
  // itself. In dev, connect straight to the API, bypassing that hop —
  // matches vite.config.ts's own hardcoded `localhost:3001` proxy targets,
  // the existing convention for this port everywhere else in dev. Same-
  // origin in production, where no such proxy sits in between.
  if (import.meta.env.DEV) return "ws://localhost:3001/ws/docs";
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
      TextStyle,
      FontFamily,
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

  return (
    <>
      {editable && <DocToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </>
  );
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

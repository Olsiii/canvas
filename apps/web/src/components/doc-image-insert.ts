import type { Editor } from "@tiptap/react";

// Split out of doc-collaborative-editor.tsx so the docs route can import
// this one function eagerly without pulling in that module's Yjs/y-websocket
// dependencies — those are only worth loading once a doc editor actually
// mounts (see route's React.lazy() usage of DocCollaborativeEditor).
export function insertImageVersionIntoEditor(editor: Editor, versionId: string) {
  editor
    .chain()
    .focus("end")
    .setImage({ src: `/image-versions/${versionId}` })
    .createParagraphNear()
    .run();
}

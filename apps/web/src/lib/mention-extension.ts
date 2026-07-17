import { MentionList, type MentionCandidate, type MentionListHandle } from "@/components/mention-list";
import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import type { RefObject } from "react";

function positionPopup(el: HTMLElement, clientRect?: (() => DOMRect | null) | null) {
  const rect = clientRect?.();
  if (!rect) return;
  el.style.position = "fixed";
  el.style.zIndex = "60";
  el.style.left = `${rect.left}px`;
  // Open upward: comment composers in this app always sit near the bottom
  // of a scrollable panel, so there's rarely room below the cursor.
  el.style.top = "";
  el.style.bottom = `${window.innerHeight - rect.top + 4}px`;
}

/**
 * Configures TipTap's Mention node with an "@" suggestion popup listing
 * workspace members. Reads candidates from a ref (rather than a plain array
 * closed over at creation time) so the member list can update without
 * recreating the editor — recreating it would reset the in-progress comment.
 */
export function createMentionExtension(candidatesRef: RefObject<MentionCandidate[]>) {
  return Mention.configure({
    HTMLAttributes: { class: "text-primary font-medium" },
    suggestion: {
      items: ({ query }) => {
        const q = query.toLowerCase();
        return candidatesRef.current.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 5);
      },
      render: () => {
        let component: ReactRenderer<MentionListHandle> | null = null;

        return {
          // Manual positioning instead of props.mount(): mount()'s
          // floating-ui autoUpdate loop fought the panel's own layout here
          // (position kept resetting to a stale, off-screen anchor), so
          // this sets position once from the suggestion's own clientRect
          // and re-derives it on every update instead.
          onStart: (props) => {
            component = new ReactRenderer(MentionList, { props, editor: props.editor });
            component.element.style.position = "fixed";
            document.body.appendChild(component.element);
            positionPopup(component.element, props.clientRect);
          },
          onUpdate: (props) => {
            component?.updateProps(props);
            if (component) positionPopup(component.element, props.clientRect);
          },
          onKeyDown: (props) => {
            if (props.event.key === "Escape") {
              component?.element.remove();
              return true;
            }
            return component?.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            component?.element.remove();
            component?.destroy();
          },
        };
      },
    },
  });
}

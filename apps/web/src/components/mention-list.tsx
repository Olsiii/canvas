import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

export type MentionCandidate = { id: string; label: string };

export interface MentionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const MentionList = forwardRef<MentionListHandle, SuggestionProps<MentionCandidate>>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const items = props.items;

    useEffect(() => setSelectedIndex(0), [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) props.command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((selectedIndex + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="border-border bg-background relative z-[60] w-48 rounded-md border p-1 shadow-lg">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectItem(index)}
            className={`block w-full truncate rounded px-2 py-1 text-left text-sm ${
              index === selectedIndex ? "bg-muted" : "hover:bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  },
);
MentionList.displayName = "MentionList";

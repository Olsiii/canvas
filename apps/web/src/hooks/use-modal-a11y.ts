import { useEffect, useRef, type KeyboardEvent } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Wires up the dialog accessibility behavior this app's bespoke slide-in
 * panels (Brain chat, task detail, Library detail, etc.) didn't have: focus
 * moves into the panel on open and is trapped there (Tab/Shift+Tab wrap at
 * the edges) instead of leaking to the page behind it, Escape closes it,
 * and focus returns to whatever opened it on close.
 *
 * Attach `ref` to the actual dialog surface (the visible panel card), not
 * the fixed-inset-0 wrapper that also contains the click-to-dismiss
 * backdrop button — that backdrop button is a sibling, not a descendant,
 * so it's correctly excluded from both the initial-focus target and the
 * tab-trap's focusable set. Also apply `role="dialog"` and `aria-modal`
 * to that same element.
 *
 * `active` defaults to true for the common case (a panel component that
 * only mounts once it's already meant to be open — its parent conditionally
 * renders it, e.g. `{open && <SomePanel onClose={...} />}`). Pass the
 * open/closed flag explicitly for the rarer shape where the component
 * itself stays mounted and toggles internally after some async check
 * (LoginSummaryPanel) — otherwise this effect fires once on that
 * always-mounted component's initial (closed) render and never again.
 */
export function useModalA11y(onClose: () => void, active = true) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? container)?.focus();

    return () => {
      previouslyFocused?.focus?.();
    };
  }, [active]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const container = containerRef.current;
    if (!container) return;
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return { containerRef, onKeyDown };
}

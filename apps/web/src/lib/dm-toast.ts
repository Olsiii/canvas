// Minimal external store for the bottom-right DM notification widget — no
// toast library exists in this app yet (checked: no `sonner`/`ui/toast`
// anywhere), and this is the only surface that needs one so far. Plain
// module state + a subscriber set, read via React's `useSyncExternalStore`
// in DmToastContainer, is enough: no provider, no context, works from any
// non-component code (the realtime event handler) that isn't itself a hook.
export type DmToast = {
  id: string;
  workspaceId: string;
  channelId: string;
  otherUserName: string;
  otherUserAvatarUrl: string | null;
  preview: string;
};

const DISPLAY_MS = 6000;

let toasts: DmToast[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeDmToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDmToasts(): DmToast[] {
  return toasts;
}

export function dismissDmToast(id: string): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function pushDmToast(toast: Omit<DmToast, "id">): void {
  const id = `${toast.channelId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  toasts = [...toasts, { ...toast, id }];
  emit();
  setTimeout(() => dismissDmToast(id), DISPLAY_MS);
}

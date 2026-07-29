import { Avatar } from "@/lib/avatar";
import { dismissDmToast, getDmToasts, subscribeDmToasts } from "@/lib/dm-toast";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";

/** Bottom-right stack of "new DM" widgets — mounted once in the workspace shell. */
export function DmToastContainer() {
  const toasts = useSyncExternalStore(subscribeDmToasts, getDmToasts, getDmToasts);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-testid={`dm-toast-${toast.channelId}`}
          className="pointer-events-auto border-border bg-card flex w-80 items-start gap-2.5 rounded-lg border p-3 shadow-lg"
        >
          <Avatar name={toast.otherUserName} avatarUrl={toast.otherUserAvatarUrl} />
          <Link
            to="/w/$workspaceId/chat/dm/$channelId"
            params={{ workspaceId: toast.workspaceId, channelId: toast.channelId }}
            onClick={() => dismissDmToast(toast.id)}
            className="min-w-0 flex-1"
          >
            <p className="truncate text-sm font-medium">{toast.otherUserName}</p>
            <p className="text-muted-foreground truncate text-xs">{toast.preview}</p>
          </Link>
          <button
            type="button"
            aria-label="Dismiss notification"
            title="Dismiss notification"
            onClick={() => dismissDmToast(toast.id)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

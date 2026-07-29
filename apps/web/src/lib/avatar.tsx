import { useState } from "react";

export function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

// A small deterministic set of accent tints so avatars aren't all one flat
// color, without needing per-user color storage — hashed from the name.
const AVATAR_TINTS = [
  "bg-accent-soft text-accent",
  "bg-status-good/15 text-status-good",
  "bg-status-warning/20 text-status-warning",
  "bg-status-serious/15 text-status-serious",
];

export function avatarTint(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]!;
}

export function Avatar({
  name,
  avatarUrl,
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden
        className={`h-8 w-8 shrink-0 rounded-full object-cover ${className ?? ""}`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTint(name)} ${className ?? ""}`}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

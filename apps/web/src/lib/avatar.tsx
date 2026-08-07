import { avatarTint, initials } from "@/lib/avatar-utils";
import { useState } from "react";

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

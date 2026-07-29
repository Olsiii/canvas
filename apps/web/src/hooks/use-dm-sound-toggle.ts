import { isDmSoundEnabled, setDmSoundEnabled } from "@/lib/dm-sound";
import { useState } from "react";

/** Backs the on/off button in the Chat sidebar; persists across sessions via localStorage. */
export function useDmSoundToggle() {
  const [enabled, setEnabled] = useState(isDmSoundEnabled);

  function toggle() {
    setEnabled((prev) => {
      const next = !prev;
      setDmSoundEnabled(next);
      return next;
    });
  }

  return { enabled, toggle };
}

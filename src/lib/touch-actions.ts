import { useEffect, useState } from "react";

/** Same predicate as `.u-touch-only` in styles.css (design.md §7). */
export const TOUCH_ACTIONS_MEDIA = "(hover: none), (max-width: 767px)";

export function touchActionsEnabled(): boolean {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(TOUCH_ACTIONS_MEDIA).matches;
}

/** True on touch devices and narrow windows where hover is unavailable. */
export function useTouchActionsEnabled(): boolean {
  const [enabled, setEnabled] = useState(touchActionsEnabled);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(TOUCH_ACTIONS_MEDIA);
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return enabled;
}

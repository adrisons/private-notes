import { useEffect, useMemo, useRef } from "react";

export interface DebouncedCallback<TArgs extends unknown[]> {
  (...args: TArgs): void;
  /**
   * Immediately run the pending call (if any) and clear the timer. Safe to call
   * when nothing is pending — it's a no-op. Use on tab close / vault switch so
   * the last edit is not lost inside the debounce window.
   */
  flush: () => void;
  /** Drop any pending call without running it. */
  cancel: () => void;
}

/**
 * Returns a stable function that defers the latest call by `delayMs`.
 * Useful for autosave: callers can invoke it on every keystroke, and `flush()`
 * the tail before navigating away.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number,
): DebouncedCallback<TArgs> {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<TArgs | null>(null);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useMemo(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const debounced = ((...args: TArgs) => {
      pendingArgsRef.current = args;
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingArgsRef.current;
        pendingArgsRef.current = null;
        if (pending) fnRef.current(...pending);
      }, delayMs);
    }) as DebouncedCallback<TArgs>;

    debounced.flush = () => {
      clearTimer();
      const pending = pendingArgsRef.current;
      pendingArgsRef.current = null;
      if (pending) fnRef.current(...pending);
    };

    debounced.cancel = () => {
      clearTimer();
      pendingArgsRef.current = null;
    };

    return debounced;
  }, [delayMs]);
}

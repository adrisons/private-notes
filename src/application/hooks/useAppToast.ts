import { useCallback, useEffect, useRef, useState } from "react";
import type { UserErrorPayload } from "../errors";
import { reportUserError } from "../errors";

const AUTO_DISMISS_MS = 12_000;

export interface UseAppToastResult {
  toast: UserErrorPayload | null;
  showError: (error: unknown) => void;
  dismiss: () => void;
}

/** Holds the current user-facing error toast and auto-dismisses after a delay. */
export function useAppToast(): UseAppToastResult {
  const [toast, setToast] = useState<UserErrorPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showError = useCallback(
    (error: unknown) => {
      dismiss();
      setToast(reportUserError(error));
      timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  useEffect(() => dismiss, [dismiss]);

  return { toast, showError, dismiss };
}

import { useCallback, useEffect, useState } from "react";

/**
 * `beforeinstallprompt` is not in the DOM lib types. Chromium fires it before
 * offering to install a PWA; capturing it lets the app trigger the native
 * prompt from its own UI (ADR-012). iOS/Firefox never fire it, so `canInstall`
 * simply stays false there.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface UseInstallPromptResult {
  /** True when the browser has offered an install prompt we can replay. */
  canInstall: boolean;
  /** True once the app is running as an installed/standalone window. */
  installed: boolean;
  /** Replays the captured prompt; resolves to whether the user accepted. */
  promptInstall: () => Promise<boolean>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.("(display-mode: standalone)").matches;
  // iOS Safari exposes a non-standard `navigator.standalone`.
  const iosStandalone = (navigator as unknown as { standalone?: boolean })
    .standalone;
  return Boolean(displayMode || iosStandalone);
}

/** Captures the install prompt so a UI affordance can offer to install the app. */
export function useInstallPrompt(): UseInstallPromptResult {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState<boolean>(isStandalone);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Prevent the mini-infobar so the app owns the moment it prompts.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // A prompt can only be used once; drop it regardless of the choice.
    setDeferred(null);
    return outcome === "accepted";
  }, [deferred]);

  return {
    canInstall: deferred !== null && !installed,
    installed,
    promptInstall,
  };
}

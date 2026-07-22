/** True when the user agent reports a macOS or iOS platform. */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
}

/**
 * True on iPhone/iPad. iPadOS 13+ reports as "MacIntel", so we treat a Mac with
 * a touch screen as iPad. Used only to tailor the unsupported-browser copy — iOS
 * has no File System Access API and stays unsupported (ADR-013).
 */
export function isIOSPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  if (/iPhone|iPod|iPad/i.test(ua)) return true;
  const maxTouchPoints =
    (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  return navigator.platform === "MacIntel" && maxTouchPoints > 1;
}

/** True on Android devices (Chrome there does support File System Access). */
export function isAndroidPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent ?? "");
}

/** Human-readable modifier key label for keyboard shortcuts. */
export function modKeyLabel(): string {
  return isMacPlatform() ? "⌘" : "Ctrl";
}

/** Formats a shortcut such as "K" as "⌘K" or "Ctrl+K". */
export function formatModKeyShortcut(key: string): string {
  const mod = modKeyLabel();
  return isMacPlatform() ? `${mod}${key}` : `${mod}+${key}`;
}

/** True when the user agent reports a macOS or iOS platform. */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
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

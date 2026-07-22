/**
 * Browser compatibility checks. The app needs:
 * - File System Access API for local read/write on the user-picked folder
 * - Web Workers (module workers) for transformers.js inference
 * - SubtleCrypto.digest for SHA-256 content hashing
 *
 * WebGPU is optional — the embedder falls back to WASM transparently.
 *
 * Supported today: Chromium desktop and Chrome on Android. iOS Safari and
 * Firefox lack the directory picker and are reported as unsupported with
 * platform-specific copy (ADR-012, ADR-013).
 */
import { isIOSPlatform } from "./platform";

/**
 * Why the app can't run here, so the UI can tailor its message:
 * - `ios`: iOS/iPadOS — no File System Access API on any iOS browser engine.
 * - `browser`: a desktop/Android browser without the required capabilities
 *   (e.g. Firefox), where switching to Chromium fixes it.
 */
export type UnsupportedKind = "ios" | "browser";

export interface CompatibilityReport {
  supported: boolean;
  reasons: string[];
  webgpu: boolean;
  /** Set only when `supported` is false; drives the Unsupported screen copy. */
  unsupportedKind?: UnsupportedKind;
}

function hasFileSystemAccess(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker === "function"
  );
}

function hasModuleWorker(): boolean {
  return typeof Worker !== "undefined";
}

function hasSubtleCrypto(): boolean {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.subtle?.digest === "function"
  );
}

function hasWebGPU(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as unknown as { gpu?: unknown }).gpu === "object"
  );
}

export function getCompatibility(): CompatibilityReport {
  const reasons: string[] = [];
  if (!hasFileSystemAccess()) {
    reasons.push(
      "File System Access API is unavailable — use Chrome, Edge, Brave, Opera, or Arc.",
    );
  }
  if (!hasModuleWorker()) {
    reasons.push("Web Workers are required for on-device search.");
  }
  if (!hasSubtleCrypto()) {
    reasons.push("Web Crypto (SubtleCrypto.digest) is required for content hashing.");
  }
  const supported = reasons.length === 0;
  return {
    supported,
    reasons,
    webgpu: hasWebGPU(),
    unsupportedKind: supported
      ? undefined
      : isIOSPlatform()
        ? "ios"
        : "browser",
  };
}

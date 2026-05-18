/**
 * Browser compatibility checks. The app needs:
 * - File System Access API for local read/write on the user-picked folder
 * - Web Workers (module workers) for transformers.js inference
 * - SubtleCrypto.digest for SHA-1 content hashing
 *
 * WebGPU is optional — the embedder falls back to WASM transparently.
 */

export interface CompatibilityReport {
  supported: boolean;
  reasons: string[];
  webgpu: boolean;
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
  return {
    supported: reasons.length === 0,
    reasons,
    webgpu: hasWebGPU(),
  };
}

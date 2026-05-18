/**
 * Feature detection and folder-picking entry point.
 *
 * `showDirectoryPicker` is gated by user activation. It throws `AbortError`
 * when the user cancels and `SecurityError` when called from a non-secure
 * context — callers should treat both as a soft cancellation.
 */
export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown })
      .showDirectoryPicker === "function"
  );
}

export interface PickFolderOptions {
  id?: string;
  startIn?: "documents" | "desktop" | "downloads" | "music" | "pictures" | "videos";
}

export async function pickFolder(
  options: PickFolderOptions = {},
): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error("File System Access API is not supported in this browser.");
  }
  try {
    // `showDirectoryPicker` is only typed under DOM lib in recent TS versions.
    const handle = await (
      window as unknown as {
        showDirectoryPicker: (
          opts?: { id?: string; mode?: "read" | "readwrite"; startIn?: string },
        ) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker({
      id: options.id ?? "private-notes-llm",
      mode: "readwrite",
      startIn: options.startIn ?? "documents",
    });
    return handle;
  } catch (err) {
    if ((err as DOMException).name === "AbortError") return null;
    throw err;
  }
}

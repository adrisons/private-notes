import { Button } from "../ui/Button";

interface VaultIndicatorProps {
  /** Folder name from the File System Access handle (not a full OS path). */
  name: string;
  onChange: () => void;
}

function FolderIcon() {
  return (
    <svg
      aria-hidden
      className="gesture-icon h-4 w-4 shrink-0 text-[var(--foreground-muted)]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

/** Sidebar header showing the open vault folder and a control to pick another. */
export function VaultIndicator({ name, onChange }: VaultIndicatorProps) {
  const label = name.trim() || "Untitled folder";

  return (
    <div className="border-b border-[var(--border)] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--foreground-muted)]">
          Vault
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={onChange}
          aria-label="Change folder"
        >
          Change
        </Button>
      </div>
      <p
        className="mt-1.5 flex min-w-0 items-center gap-2 text-sm text-[var(--foreground)]"
        aria-label={`Open folder: ${label}`}
      >
        <FolderIcon />
        <span className="truncate">{label}</span>
      </p>
    </div>
  );
}

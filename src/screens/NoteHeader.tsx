import { Button } from "../ui/Button";

interface NoteHeaderProps {
  title: string;
  onTitleChange: (value: string) => void;
  onDelete: () => void;
  onInsertImage: () => void;
  savedAt: string | null;
}

export function NoteHeader({
  title,
  onTitleChange,
  onDelete,
  onInsertImage,
  savedAt,
}: NoteHeaderProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 pt-10">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
          {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onInsertImage}>
            Insert image
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled"
        className="mt-4 w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-[var(--color-muted-foreground)]"
      />
    </div>
  );
}

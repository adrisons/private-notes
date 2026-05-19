import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} label={title}>
      <div className="p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? (
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            {description}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onConfirm}
            className={
              destructive
                ? "bg-[var(--color-danger)] text-white hover:opacity-90"
                : undefined
            }
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

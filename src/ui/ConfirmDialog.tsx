import { ActionDialog } from "./ActionDialog";

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
    <ActionDialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      primaryLabel={confirmLabel}
      secondaryLabel={cancelLabel}
      onPrimary={onConfirm}
      primaryClassName={
        destructive
          ? "bg-[var(--danger)] text-white shadow-[var(--shadow-offset-danger),var(--shadow-rest)]"
          : undefined
      }
      autoFocusPrimary
    />
  );
}

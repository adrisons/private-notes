import { ActionDialog } from "../ui/ActionDialog";

export interface VaultOpenBlockedDialogProps {
  open: boolean;
  message: string;
  fixHint: string;
  onChooseAnother: () => void;
  onClose: () => void;
}

/** Explain why a picked folder cannot be opened as a vault. */
export function VaultOpenBlockedDialog({
  open,
  message,
  fixHint,
  onChooseAnother,
  onClose,
}: VaultOpenBlockedDialogProps) {
  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Cannot open this folder"
      description={
        <>
          <p>{message}</p>
          <p className="mt-3">{fixHint}</p>
        </>
      }
      primaryLabel="Choose another folder"
      secondaryLabel="Close"
      onPrimary={onChooseAnother}
      autoFocusPrimary
    />
  );
}

import { ActionDialog } from "../ui/ActionDialog";

export interface RepairVaultDialogProps {
  open: boolean;
  noteCount: number;
  repairing: boolean;
  onRepair: () => void;
  onClose: () => void;
}

/** Offer to rebuild vault metadata when note files exist without a manifest. */
export function RepairVaultDialog({
  open,
  noteCount,
  repairing,
  onRepair,
  onClose,
}: RepairVaultDialogProps) {
  const noteLabel = noteCount === 1 ? "1 note file" : `${noteCount} note files`;

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Repair this folder?"
      description={
        <>
          <p>
            This folder contains {noteLabel} under <code>notes/</code>, but it is
            missing the <code>.private-notes/</code> metadata that private-notes
            needs to open it.
          </p>
          <p className="mt-3">
            Repair will recreate the vault index from your note files. Space
            names cannot be recovered automatically — they will appear as
            placeholders you can rename afterward.
          </p>
          <p className="mt-3">
            Search will rebuild its index the first time you search.
          </p>
        </>
      }
      primaryLabel={repairing ? "Repairing…" : "Repair and open"}
      secondaryLabel="Choose another folder"
      onPrimary={onRepair}
      primaryDisabled={repairing}
      autoFocusPrimary
    />
  );
}

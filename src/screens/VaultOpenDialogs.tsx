import { RepairVaultDialog } from "./RepairVaultDialog";
import { VaultOpenBlockedDialog } from "./VaultOpenBlockedDialog";
import type { UseVaultSessionResult } from "../application/hooks/useVaultSession";

interface VaultOpenDialogsProps {
  vault: UseVaultSessionResult;
}

/** Modals for vault picker failures — repair offer or blocked folder. */
export function VaultOpenDialogs({ vault }: VaultOpenDialogsProps) {
  const repair =
    vault.openIssue?.kind === "repair" ? vault.openIssue : null;
  const blocked =
    vault.openIssue?.kind === "blocked" ? vault.openIssue : null;

  return (
    <>
      <RepairVaultDialog
        open={repair !== null}
        noteCount={repair?.noteCount ?? 0}
        repairing={vault.repairing}
        onRepair={() => void vault.repairAndOpen()}
        onClose={vault.chooseAnotherFolder}
      />
      <VaultOpenBlockedDialog
        open={blocked !== null}
        message={blocked?.message ?? ""}
        fixHint={blocked?.fixHint ?? ""}
        onChooseAnother={vault.chooseAnotherFolder}
        onClose={vault.dismissOpenIssue}
      />
    </>
  );
}

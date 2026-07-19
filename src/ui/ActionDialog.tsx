import type { ReactNode } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { cn } from "../lib/cn";

export interface ActionDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryClassName?: string;
  autoFocusPrimary?: boolean;
}

/** Dialog shell with a title, optional body, and primary/secondary actions. */
export function ActionDialog({
  open,
  onClose,
  title,
  description,
  primaryLabel,
  secondaryLabel = "Close",
  onPrimary,
  primaryDisabled,
  primaryClassName,
  autoFocusPrimary,
}: ActionDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} label={title}>
      <div className="p-6">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <div className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
            {description}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {secondaryLabel}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className={cn(primaryClassName)}
            autoFocus={autoFocusPrimary}
          >
            {primaryLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

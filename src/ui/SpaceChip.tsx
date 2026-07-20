import { cn } from "../lib/cn";
import type { CSSProperties } from "react";
import type { SpaceColorId } from "../application/view-models";
import { spaceChipStyle } from "./space-colors";

export interface SpaceChipProps {
  name: string;
  colorId: SpaceColorId | null;
  size?: "sm" | "md";
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/** Muted badge for a note space — uses design-token chip colors. */
export function SpaceChip({
  name,
  colorId,
  size = "sm",
  className,
  style,
  title,
}: SpaceChipProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-[var(--radius-sm)] font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[10px] leading-4" : "px-2 py-0.5 text-xs",
        className,
      )}
      style={{ ...spaceChipStyle(colorId), ...style }}
    >
      {name}
    </span>
  );
}

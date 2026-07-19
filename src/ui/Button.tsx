import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "u-focus inline-flex cursor-pointer items-center justify-center gap-2 " +
  "rounded-[var(--radius-md)] font-medium " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

const variants: Record<Variant, string> = {
  // The pressable slab — a solid offset body you push into (design.md §5.8).
  // Reserved for primary actions so it stays special.
  primary:
    "u-slab bg-[var(--accent)] text-[var(--accent-foreground)] " +
    "hover:bg-[var(--accent-hover)]",
  secondary:
    "u-press u-lift border border-[var(--border)] bg-[var(--surface-raised)] " +
    "text-[var(--foreground)] shadow-[var(--shadow-rest)] " +
    "hover:border-[var(--border-strong)]",
  ghost:
    "u-press text-[var(--foreground-muted)] hover:bg-[var(--surface-raised)] " +
    "hover:text-[var(--foreground)]",
  // Destructive is a ghost button that happens to be red: identical shape and
  // press response, danger tint on hover only (design.md §5.7).
  danger: "gesture-danger u-press text-[var(--foreground-muted)]",
};

const sizes: Record<Size, string> = {
  // Touch targets stay at 44px below `md`, tighten to 36/40px on pointer
  // devices (design.md §5.3).
  sm: "h-9 min-w-9 px-3.5 text-sm max-md:h-11 max-md:min-w-11",
  md: "h-10 min-w-10 px-4 text-sm max-md:h-11 max-md:min-w-11",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], sizes[size], className)}
        {...rest}
      />
    );
  },
);

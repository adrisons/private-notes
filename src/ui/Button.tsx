import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--color-background)] " +
  "disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-accent-foreground)] " +
    "hover:brightness-110 active:brightness-95",
  secondary:
    "border border-[var(--color-border)] bg-[var(--color-background)] " +
    "text-[var(--color-foreground)] hover:border-[var(--color-foreground)]/25 " +
    "hover:bg-[var(--color-muted)] active:bg-[var(--color-border)]",
  ghost:
    "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] " +
    "hover:text-[var(--color-foreground)] active:bg-[var(--color-border)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 min-w-8 px-3 text-sm sm:h-9",
  md: "h-10 min-w-10 px-4 text-sm sm:h-11",
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

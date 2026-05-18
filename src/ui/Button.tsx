import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--color-background)] " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:opacity-90",
  secondary:
    "border border-[var(--color-border)] bg-[var(--color-background)] " +
    "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
  ghost:
    "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
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

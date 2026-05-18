import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-10 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)]",
        "px-3 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
});

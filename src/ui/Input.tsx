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
        "u-focus h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)]",
        "bg-[var(--surface-raised)] shadow-[var(--shadow-rest)]",
        "px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)]",
        "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-smooth)]",
        "hover:border-[var(--border-strong)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
});

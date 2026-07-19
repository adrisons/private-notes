import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type Variant = "default" | "ghost";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  default:
    "h-11 rounded-[var(--radius-md)] border border-[var(--border)] " +
    "bg-[var(--surface-raised)] shadow-[var(--shadow-rest)] px-3 " +
    "hover:border-[var(--border-strong)]",
  ghost:
    "border-0 bg-transparent shadow-none px-0 " +
    "hover:border-transparent",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = "text", variant = "default", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "u-focus w-full text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)]",
        "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-smooth)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
});

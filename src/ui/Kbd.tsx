import { cn } from "../lib/cn";

interface KbdProps {
  children: string;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex min-h-5 min-w-5 items-center justify-center rounded-[var(--radius-sm)] border",
        "border-[var(--border)] bg-[var(--surface)] px-1.5",
        "font-mono text-xs font-medium leading-none text-[var(--foreground-muted)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

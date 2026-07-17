import { cn } from "../lib/cn";

interface KbdProps {
  children: string;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex min-h-5 min-w-5 items-center justify-center rounded border",
        "border-[var(--color-border)] bg-[var(--color-muted)] px-1.5",
        "font-mono text-[10px] font-medium leading-none text-[var(--color-muted-foreground)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

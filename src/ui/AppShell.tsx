import type { ReactNode } from "react";

interface AppShellProps {
  header?: ReactNode;
  sidebar?: ReactNode;
  children?: ReactNode;
}

/**
 * Three-region layout: top header, optional left sidebar, and main content.
 * Designed to feel like a focused editor — a lot of whitespace, no chrome.
 */
export function AppShell({ header, sidebar, children }: AppShellProps) {
  return (
    <div className="grid h-dvh grid-rows-[auto_1fr]">
      {header ? (
        <header className="flex h-14 items-center border-b border-[var(--color-border)] px-5">
          {header}
        </header>
      ) : null}
      <div
        className={
          sidebar
            ? "grid grid-cols-1 overflow-hidden sm:grid-cols-[280px_1fr]"
            : "overflow-hidden"
        }
      >
        {sidebar ? (
          <aside className="overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-muted)]">
            {sidebar}
          </aside>
        ) : null}
        <main className="overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

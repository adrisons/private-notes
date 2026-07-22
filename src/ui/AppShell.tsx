import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

interface AppShellProps {
  header?: ReactNode;
  sidebar?: ReactNode;
  /**
   * Changing this value collapses the mobile panel and hands focus back to the
   * content — the app passes the selected note id (docs/design.md §8).
   */
  collapseKey?: string | null;
  children?: ReactNode;
}

function DisclosureIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line className="bar bar-top" x1="4" y1="6" x2="20" y2="6" />
      <line className="bar bar-mid" x1="4" y1="12" x2="20" y2="12" />
      <line className="bar bar-bottom" x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

/**
 * Three-region layout: top header, optional left sidebar, and main content.
 *
 * Below the `md` breakpoint the sidebar is not stacked above the content —
 * that pushed the open note off screen. It collapses into a disclosure in the
 * header and unrolls over the content instead (docs/design.md §8).
 */
export function AppShell({
  header,
  sidebar,
  collapseKey = null,
  children,
}: AppShellProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelId = useId();
  const mainId = useId();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  // Picking a note collapses the panel and returns focus to the content.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPanelOpen((open) => {
      if (open) mainRef.current?.focus();
      return false;
    });
  }, [collapseKey]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, closePanel]);

  return (
    // Safe-area insets keep the header and content clear of the notch and home
    // indicator when installed as a standalone PWA (index.html sets
    // `viewport-fit=cover`). Padding is inside `h-dvh` (border-box), so the
    // layout never overflows the viewport.
    <div
      className="grid h-dvh grid-rows-[auto_1fr] bg-[var(--canvas)]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <a href={`#${mainId}`} className="u-skip-link">
        Skip to content
      </a>
      {header ? (
        <header className="flex h-[var(--header-height)] items-center gap-2 border-b border-[var(--border-strong)] bg-[var(--surface)] px-4 sm:px-5">
          {sidebar ? (
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              aria-expanded={panelOpen}
              aria-controls={panelId}
              aria-label={panelOpen ? "Hide notes and search" : "Show notes and search"}
              // No negative margin: it pushed the control against the viewport
              // edge and clipped its focus ring.
              className="gesture-disclosure u-press u-focus inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-full)] text-[var(--foreground-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)] md:hidden"
            >
              <DisclosureIcon />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">{header}</div>
        </header>
      ) : null}
      <div
        className={
          sidebar
            ? "relative grid min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[var(--sidebar-width)_1fr]"
            : "min-h-0 overflow-hidden"
        }
      >
        {sidebar && panelOpen ? (
          <div
            role="presentation"
            onClick={closePanel}
            className="u-enter-backdrop absolute inset-0 z-20 bg-[var(--backdrop)] md:hidden"
          />
        ) : null}

        {/*
          One sidebar instance, two layouts. On mobile it is an absolutely
          positioned disclosure that unrolls over the content; from `md` up the
          wrappers become `display: contents` and the <aside> is the grid
          column itself.
        */}
        {sidebar ? (
          <div
            id={panelId}
            data-open={panelOpen}
            className="u-disclosure absolute inset-x-0 top-0 z-30 md:contents"
          >
            <div className="md:contents">
              <aside
                aria-label="Notes and search"
                data-virtual-list-scroll=""
                className="u-scrollbar flex max-h-[70dvh] min-h-0 flex-col overflow-x-hidden overflow-y-auto border-b border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-overlay)] md:h-full md:max-h-none md:border-r md:border-b-0 md:shadow-none"
              >
                {sidebar}
              </aside>
            </div>
          </div>
        ) : null}

        <main
          id={mainId}
          ref={mainRef}
          tabIndex={-1}
          aria-label="Note content"
          className="flex min-h-0 flex-col overflow-hidden outline-none"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  /** Human-readable action name, sentence case. Never an identifier. */
  label: string;
  /** Optional keyboard hint, rendered in the mono face. */
  shortcut?: string;
  /** A single interactive element. */
  children: ReactNode;
}

/**
 * App-styled tooltip (docs/design.md §5). Replaces the native `title`, which
 * cannot be tokenized and renders as an OS-grey box.
 *
 * It portals to `document.body` on purpose: triggers live inside the editor
 * toolbar, which clips its overflow while collapsed, and a transformed
 * ancestor would trap a `position: fixed` child inside that clip.
 *
 * The tooltip is `aria-hidden`: the trigger already carries the same text as
 * its accessible name, so exposing it would announce everything twice.
 */
export function Tooltip({ label, shortcut, children }: TooltipProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const show = useCallback(() => {
    const trigger = hostRef.current?.firstElementChild;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // Keep the bubble on screen without measuring it: clamp its centre.
    const margin = 72;
    const x = Math.min(
      Math.max(rect.left + rect.width / 2, margin),
      window.innerWidth - margin,
    );
    setAnchor({ x, y: rect.bottom + 8 });
  }, []);

  const hide = useCallback(() => setAnchor(null), []);

  /*
   * Scrolling invalidates the measured position, so follow the trigger rather
   * than dismiss: focusing a control that the toolbar has clipped makes the
   * browser scroll it into view, and dismissing there would kill the tooltip
   * the instant a keyboard user reached the control.
   */
  useEffect(() => {
    if (!anchor) return;
    window.addEventListener("scroll", show, true);
    return () => window.removeEventListener("scroll", show, true);
  }, [anchor, show]);

  return (
    <>
      <span
        ref={hostRef}
        className="contents"
        // Pointer tooltips are for pointers. On touch a tap would leave a
        // bubble sitting on top of the controls next to the one just pressed.
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") show();
        }}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={(e) => {
          const target = e.target;
          if (!(target instanceof HTMLElement)) return;
          // Keyboard discovery only. A touch tap also focuses the control but
          // must not open a bubble — there is no hover on touch (design.md §5).
          requestAnimationFrame(() => {
            if (
              document.activeElement === target &&
              target.matches(":focus-visible")
            ) {
              show();
            }
          });
        }}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === "Escape") hide();
        }}
      >
        {children}
      </span>
      {anchor
        ? createPortal(
            <div
              role="tooltip"
              aria-hidden
              className="u-tooltip-anchor"
              style={{ left: anchor.x, top: anchor.y }}
            >
              <span className="u-tooltip">
                <span className="u-tooltip-label">{label}</span>
                {shortcut ? (
                  <kbd className="u-tooltip-shortcut">{shortcut}</kbd>
                ) : null}
              </span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

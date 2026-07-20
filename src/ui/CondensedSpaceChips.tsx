import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { SpaceChip } from "./SpaceChip";
import type { SpaceChipDisplay } from "../application/view-models";
import {
  computeCondensedChipsLayout,
  type CondensedChipsLayout,
} from "./condensed-chips-layout";

const CHIP_GAP_PX = 4;

const EMPTY_LAYOUT: CondensedChipsLayout = {
  visibleCount: 0,
  truncateLast: false,
  lastChipMaxWidth: null,
  showOverflowEllipsis: false,
};

interface CondensedSpaceChipsProps {
  chips: SpaceChipDisplay[];
}

/** Sidebar row chips: full labels while they fit, then "…" for the rest. */
export function CondensedSpaceChips({ chips }: CondensedSpaceChipsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<CondensedChipsLayout>(EMPTY_LAYOUT);

  const remeasure = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure || chips.length === 0) {
      setLayout(EMPTY_LAYOUT);
      return;
    }

    const chipWidths = Array.from(
      measure.querySelectorAll<HTMLElement>("[data-chip-measure]"),
    ).map((element) => element.offsetWidth);

    const ellipsisWidth =
      measure.querySelector<HTMLElement>("[data-ellipsis-measure]")
        ?.offsetWidth ?? 0;

    setLayout(
      computeCondensedChipsLayout(
        container.clientWidth,
        chipWidths,
        ellipsisWidth,
        CHIP_GAP_PX,
      ),
    );
  }, [chips]);

  useLayoutEffect(() => {
    remeasure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(remeasure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [remeasure]);

  if (chips.length === 0) return null;

  const visible = chips.slice(0, layout.visibleCount);
  const hidden = chips.slice(layout.visibleCount);

  return (
    <>
      <div
        ref={measureRef}
        className="pointer-events-none invisible absolute h-0 overflow-hidden whitespace-nowrap"
        aria-hidden
      >
        <div className="inline-flex items-center gap-1">
          {chips.map((chip) => (
            <span key={chip.name} data-chip-measure className="inline-flex">
              <SpaceChip name={chip.name} colorId={chip.colorId} />
            </span>
          ))}
          <span
            data-ellipsis-measure
            className="inline-block shrink-0 px-0.5 text-[10px] leading-4 text-[var(--foreground-muted)]"
          >
            …
          </span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden"
      >
        {visible.map((chip, index) => {
          const isTruncated =
            layout.truncateLast && index === visible.length - 1;
          return (
            <SpaceChip
              key={chip.name}
              name={chip.name}
              colorId={chip.colorId}
              className={isTruncated ? "min-w-0 shrink truncate" : "shrink-0"}
              style={
                isTruncated && layout.lastChipMaxWidth !== null
                  ? { maxWidth: layout.lastChipMaxWidth }
                  : undefined
              }
              title={
                hidden.length > 0 && index === visible.length - 1 && !isTruncated
                  ? `${chip.name} (+${hidden.length} more)`
                  : chip.name
              }
            />
          );
        })}
        {layout.showOverflowEllipsis ? (
          <span
            aria-hidden
            className="shrink-0 px-0.5 text-[10px] leading-4 text-[var(--foreground-muted)]"
          >
            …
          </span>
        ) : null}
      </div>
    </>
  );
}

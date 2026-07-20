import {
  cloneElement,
  Fragment,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "../lib/cn";

/** Below this count every row stays in the DOM (keyboard + swipe stay simple). */
export const VIRTUAL_LIST_THRESHOLD = 50;

/** Virtualize every non-empty list (e.g. sidebar spaces, space detail notes). */
export const ALWAYS_VIRTUALIZE_THRESHOLD = 0;

export const DEFAULT_ROW_GAP = 8;

export const NOTE_LIST_ROW_HEIGHT = 72;

export type VirtualListScrollMode = "internal" | "external";

export interface VirtualListHandle {
  scrollToIndex: (index: number) => void;
}

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  gap?: number;
  ariaLabel: string;
  emptyState?: ReactNode;
  className?: string;
  listClassName?: string;
  /** When external, the nearest overflow ancestor owns scrolling (e.g. the sidebar). */
  scrollMode?: VirtualListScrollMode;
  /** Item count above which rows are windowed. Defaults to {@link VIRTUAL_LIST_THRESHOLD}. */
  virtualizeThreshold?: number;
  onKeyDown?: KeyboardEventHandler<HTMLUListElement>;
  listRef?: Ref<HTMLUListElement>;
  ariaMultiselectable?: boolean;
  getItemKey: (item: T, index: number) => string;
  /** Row root must accept an optional `style` (e.g. `<li>` for NoteListRow). */
  renderItem: (item: T, index: number) => ReactNode;
}

function findScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function offsetWithinScrollParent(
  element: HTMLElement,
  scrollParent: HTMLElement,
): number {
  const elementRect = element.getBoundingClientRect();
  const parentRect = scrollParent.getBoundingClientRect();
  return elementRect.top - parentRect.top + scrollParent.scrollTop;
}

function VirtualListInner<T>(
  {
    items,
    itemHeight,
    gap = DEFAULT_ROW_GAP,
    ariaLabel,
    emptyState,
    className,
    listClassName,
    scrollMode = "internal",
    virtualizeThreshold = VIRTUAL_LIST_THRESHOLD,
    onKeyDown,
    listRef,
    ariaMultiselectable,
    getItemKey,
    renderItem,
  }: VirtualListProps<T>,
  ref: Ref<VirtualListHandle>,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mergedListRef = useRef<HTMLUListElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const stride = itemHeight + gap;
  const virtualize = items.length > virtualizeThreshold;
  const externalScroll = virtualize && scrollMode === "external";

  const assignListRef = useCallback(
    (node: HTMLUListElement | null) => {
      mergedListRef.current = node;
      if (typeof listRef === "function") listRef(node);
      else if (listRef) listRef.current = node;
    },
    [listRef],
  );

  const syncExternalScroll = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const scrollParent = findScrollParent(root);
    if (!scrollParent) return;

    const offset = offsetWithinScrollParent(root, scrollParent);
    setViewportHeight(scrollParent.clientHeight);
    setScrollTop(Math.max(0, scrollParent.scrollTop - offset));
  }, []);

  useImperativeHandle(ref, () => ({
    scrollToIndex(index: number) {
      const clamped = Math.max(0, Math.min(items.length - 1, index));

      if (externalScroll) {
        const root = rootRef.current;
        if (!root) return;
        const scrollParent = findScrollParent(root);
        if (!scrollParent) return;
        const offset = offsetWithinScrollParent(root, scrollParent);
        scrollParent.scrollTop = offset + clamped * stride;
        setScrollTop(clamped * stride);
        return;
      }

      const el = scrollRef.current;
      if (!el) return;
      el.scrollTop = clamped * stride;
      setScrollTop(el.scrollTop);
    },
  }));

  useEffect(() => {
    if (!virtualize || externalScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportHeight(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [virtualize, externalScroll]);

  useEffect(() => {
    if (!externalScroll) return;
    const root = rootRef.current;
    if (!root) return;
    const scrollParent = findScrollParent(root);
    if (!scrollParent) return;

    syncExternalScroll();
    scrollParent.addEventListener("scroll", syncExternalScroll, { passive: true });
    const observer = new ResizeObserver(syncExternalScroll);
    observer.observe(scrollParent);
    observer.observe(root);
    return () => {
      scrollParent.removeEventListener("scroll", syncExternalScroll);
      observer.disconnect();
    };
  }, [externalScroll, syncExternalScroll, items.length]);

  const overscan = 6;
  const startIndex = virtualize
    ? Math.max(0, Math.floor(scrollTop / stride) - overscan)
    : 0;
  const endIndex = virtualize
    ? Math.min(
        items.length - 1,
        Math.ceil((scrollTop + viewportHeight) / stride) + overscan,
      )
    : items.length - 1;
  const totalHeight =
    items.length > 0 ? items.length * stride - gap : 0;

  const renderRow = (item: T, index: number) => {
    const node = renderItem(item, index);
    if (!virtualize || !isValidElement(node)) return node;
    const element = node as ReactElement<{ style?: CSSProperties }>;
    return cloneElement(element, {
      style: {
        ...element.props.style,
        position: "absolute",
        top: index * stride,
        left: 0,
        right: 0,
        height: itemHeight,
      },
    });
  };

  const visibleItems = virtualize
    ? items.slice(startIndex, endIndex + 1)
    : items;

  const list = (
    <ul
      ref={assignListRef}
      role="list"
      aria-label={ariaLabel}
      aria-multiselectable={ariaMultiselectable || undefined}
      onKeyDown={onKeyDown}
      className={cn(
        "outline-none",
        virtualize ? "relative w-full" : "space-y-2",
        listClassName,
      )}
      style={virtualize ? { height: totalHeight } : undefined}
    >
      {items.length === 0 ? (
        <li className="list-none">{emptyState}</li>
      ) : (
        visibleItems.map((item, offset) => {
          const index = virtualize ? startIndex + offset : offset;
          return (
            <Fragment key={getItemKey(item, index)}>
              {renderRow(item, index)}
            </Fragment>
          );
        })
      )}
    </ul>
  );

  if (!virtualize) {
    if (scrollMode === "internal") {
      return (
        <div
          ref={rootRef}
          data-virtual-list-scroll=""
          className={cn("u-scrollbar min-h-0 overflow-y-auto", className)}
        >
          {list}
        </div>
      );
    }
    return (
      <div ref={rootRef} className={className}>
        {list}
      </div>
    );
  }

  if (externalScroll) {
    return (
      <div ref={rootRef} className={className}>
        {list}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      data-virtual-list-scroll=""
      className={cn("u-scrollbar min-h-0 overflow-y-auto", className)}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      {list}
    </div>
  );
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: Ref<VirtualListHandle> },
) => ReturnType<typeof VirtualListInner>;

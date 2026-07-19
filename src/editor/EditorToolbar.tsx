import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "../lib/cn";
import { TextStyleSelect } from "./TextStyleSelect";
import { Tooltip } from "../ui/Tooltip";

/**
 * First descendant that actually has a layout box. Controls are wrapped in
 * `Tooltip`, whose host is `display: contents` and therefore reports a height
 * of zero — measuring it would collapse the toolbar to a sliver.
 */
function firstMeasurableChild(root: Element): HTMLElement | null {
  for (const child of Array.from(root.children)) {
    const node = child as HTMLElement;
    if (node.offsetHeight > 0) return node;
    const nested = firstMeasurableChild(node);
    if (nested) return nested;
  }
  return null;
}

/**
 * Measures the toolbar so it can clamp itself to a single row and unroll on
 * hover. Heights are read from the DOM rather than guessed, which is what
 * lets the transition animate `height` honestly (docs/design.md §5.4).
 */
function useRowClamp() {
  const rowRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState({ collapsed: 0, expanded: 0, chrome: 0 });

  useLayoutEffect(() => {
    const row = rowRef.current;
    const clip = clipRef.current;
    const pill = clip?.parentElement;
    if (!row || !clip || !pill) return;

    const measure = () => {
      const first = firstMeasurableChild(row);
      const style = getComputedStyle(clip);
      const padding =
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      setSizes((prev) => {
        const next = {
          // `height` is border-box here, so both values carry the padding.
          collapsed: (first?.offsetHeight ?? 0) + padding,
          expanded: row.offsetHeight + padding,
          // Pill border, constant while the row clamps.
          chrome: prev.chrome || pill.offsetHeight - clip.offsetHeight,
        };
        return next.collapsed === prev.collapsed &&
          next.expanded === prev.expanded &&
          next.chrome === prev.chrome
          ? prev
          : next;
      });
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  // A one-pixel slack absorbs sub-pixel rounding on fractional zoom levels.
  const clamped = sizes.expanded > sizes.collapsed + 1;

  return { rowRef, clipRef, sizes, clamped };
}

interface ToolbarProps {
  editor: Editor | null;
  onPickImage?: (file: File) => void | Promise<void>;
}

interface MarkAction {
  name: "bold" | "italic" | "underline" | "strike" | "codeBlock";
  /** Glyph shown in the toolbar. */
  label: string;
  /** Human-readable name for the tooltip and the accessible name. */
  title: string;
  shortcut: string;
  mono?: boolean;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => boolean;
}

interface BlockAction {
  name: string;
  label: string;
  title: string;
  shortcut: string;
  mono?: boolean;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => boolean;
}

const MARK_ACTIONS: MarkAction[] = [
  {
    name: "bold",
    title: "Bold",
    label: "B",
    shortcut: "⌘B",
    isActive: (e) => e.isActive("bold"),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    name: "italic",
    title: "Italic",
    label: "I",
    shortcut: "⌘I",
    isActive: (e) => e.isActive("italic"),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    name: "underline",
    title: "Underline",
    label: "U",
    shortcut: "⌘U",
    isActive: (e) => e.isActive("underline"),
    run: (e) => e.chain().focus().toggleUnderline().run(),
  },
  {
    name: "strike",
    title: "Strikethrough",
    label: "S",
    shortcut: "⇧⌘X",
    isActive: (e) => e.isActive("strike"),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    name: "codeBlock",
    title: "Code block",
    label: "{ }",
    shortcut: "⌥⌘C",
    mono: true,
    isActive: (e) => e.isActive("codeBlock"),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

const BLOCK_ACTIONS: BlockAction[] = [
  {
    name: "bulletList",
    title: "Bullet list",
    label: "•",
    shortcut: "⇧⌘8",
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    name: "orderedList",
    title: "Numbered list",
    label: "1.",
    shortcut: "⇧⌘7",
    mono: true,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    name: "blockquote",
    title: "Quote",
    label: "",
    shortcut: "⇧⌘B",
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    name: "horizontalRule",
    title: "Divider",
    label: "—",
    shortcut: "---",
    isActive: (e) => e.isActive("horizontalRule"),
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

/** Line icon, 24px grid, round caps — never an emoji (design.md §1.2). */
function QuoteIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 11h3v6H4V11c0-2 1.5-3.5 3-4" />
      <path d="M17 11h3v6h-6V11c0-2 1.5-3.5 3-4" />
    </svg>
  );
}

/** Line icon, 24px grid, round caps — never an emoji (design.md §1.2). */
function ImageIcon() {
  return (
    <svg
      aria-hidden
      className="gesture-icon h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 15l-4.5-4.5L7 20" />
    </svg>
  );
}

/** Chevron for the expand toggle. */
function ChevronIcon() {
  return (
    <svg
      aria-hidden
      className="gesture-icon h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ToolbarButton({
  label,
  name,
  title,
  shortcut,
  active,
  disabled,
  mono,
  onClick,
}: {
  label: string;
  name: string;
  title: string;
  shortcut: string;
  active: boolean;
  disabled: boolean;
  mono?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip label={title} shortcut={shortcut}>
    <button
      type="button"
      aria-pressed={active}
      aria-label={`${title} (${shortcut})`}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // Same playful zoom as the sidebar's + (design.md §4.7).
        "gesture-zoom u-press u-focus h-9 min-w-9 rounded-[var(--radius-full)] px-2 text-sm font-medium max-md:h-11 max-md:min-w-11",
        "hover:bg-[var(--accent-soft)] hover:text-[var(--accent-soft-foreground)]",
        active && "bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)]",
        name === "italic" && "italic",
        name === "underline" && "underline",
        name === "strike" && "line-through",
        name === "bold" && "font-bold",
        mono && "font-[family-name:var(--font-mono)] text-xs",
        "disabled:opacity-50",
      )}
    >
      {name === "blockquote" ? <QuoteIcon /> : label}
    </button>
    </Tooltip>
  );
}

export function EditorToolbar({ editor, onPickImage }: ToolbarProps) {
  const { rowRef, clipRef, sizes, clamped } = useRowClamp();
  const [expanded, setExpanded] = useState(false);
  const clipId = useId();

  return (
    // Sticky: the controls stay reachable while reading a long note.
    <div className="sticky top-0 z-20 w-full max-w-[var(--measure)] bg-[var(--canvas)] px-5 pt-4 pb-2 sm:px-6">
      {/*
        The host reserves the collapsed height; the pill floats inside it. That
        way unrolling on hover slides over the note instead of shoving the text
        down mid-read.
      */}
      <div
        className="u-clamp-host u-clamp-spacer relative"
        data-open={expanded}
        style={
          {
            "--clamp-collapsed": `${sizes.collapsed}px`,
            "--clamp-expanded": `${sizes.expanded}px`,
            "--clamp-spacer": `${(clamped ? sizes.collapsed : sizes.expanded) + sizes.chrome}px`,
          } as CSSProperties
        }
      >
        {/* A raised pill rather than a full-bleed bar: a control surface
            floating on the page, in the sidebar's rounded language. */}
        <div className="absolute inset-x-0 top-0 flex items-start rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-rest)]">
          {/*
            The padding lives on the clipping box, not on the pill: a control
            zoomed to 1.14 (and its focus ring) would otherwise be cut off by
            `overflow: hidden` while the row is clamped.
          */}
          <div
            id={clipId}
            ref={clipRef}
            className={cn("min-w-0 flex-1 p-1.5", clamped && "u-clamp-row")}
          >
            <div ref={rowRef} className="flex flex-wrap items-center gap-1">
            <TextStyleSelect editor={editor} />

            <span aria-hidden className="mx-1 h-5 w-px bg-[var(--border)]" />

            {MARK_ACTIONS.map((action) => (
              <ToolbarButton
                key={action.name}
                label={action.label}
                name={action.name}
                title={action.title}
                shortcut={action.shortcut}
                active={editor ? action.isActive(editor) : false}
                disabled={!editor}
                mono={action.mono}
                onClick={() => editor && action.run(editor)}
              />
            ))}

            <span aria-hidden className="mx-1 h-5 w-px bg-[var(--border)]" />

            {BLOCK_ACTIONS.map((action) => (
              <ToolbarButton
                key={action.name}
                label={action.label}
                name={action.name}
                title={action.title}
                shortcut={action.shortcut}
                active={editor ? action.isActive(editor) : false}
                disabled={!editor}
                mono={action.mono}
                onClick={() => editor && action.run(editor)}
              />
            ))}

            {/*
              The only image affordance in the app. The note header used to
              carry a second "Insert image" button that did nothing.
            */}
            {onPickImage ? (
              <Tooltip label="Insert image">
              <label
                className={cn(
                  "u-press u-focus-within gesture-attach ml-auto inline-flex h-9 cursor-pointer items-center gap-1.5",
                  "rounded-[var(--radius-full)] px-2.5 text-sm text-[var(--foreground-muted)] max-md:h-11",
                  "hover:bg-[var(--accent-soft)] hover:text-[var(--accent-soft-foreground)]",
                  !editor && "pointer-events-none opacity-40",
                )}
              >
                <ImageIcon />
                <span>Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label="Insert image"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onPickImage(file);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              </Tooltip>
            ) : null}
            </div>
          </div>

          {/*
            Touch devices cannot hover, so the clamp needs an explicit control.
            It lives outside the clipped box: anything inside would be hidden by
            the very clamp it is meant to open.
          */}
          {clamped ? (
            <Tooltip label={expanded ? "Fewer controls" : "More controls"}>
              <button
                type="button"
                onClick={() => setExpanded((open) => !open)}
                aria-expanded={expanded}
                aria-controls={clipId}
                aria-label={
                  expanded
                    ? "Show fewer formatting controls"
                    : "Show more formatting controls"
                }
                // Touch-only affordance: pointer devices unroll on hover.
                className="gesture-more u-touch-only u-press u-focus m-1.5 h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-full)] text-[var(--foreground-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-soft-foreground)]"
              >
                <ChevronIcon />
              </button>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </div>
  );
}

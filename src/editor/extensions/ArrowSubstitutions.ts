import { Extension, InputRule } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import type { ResolvedPos } from "@tiptap/pm/model";

/** Longest suffix first so `<->` is not cut short by the `<--` rule. */
const ARROW_SUFFIXES: readonly { suffix: string; arrow: string }[] = [
  { suffix: "<->", arrow: "↔" },
  { suffix: "<--", arrow: "←" },
  { suffix: "-->", arrow: "→" },
];

const ARROW_TO_SOURCE = Object.fromEntries(
  ARROW_SUFFIXES.map(({ suffix, arrow }) => [arrow, suffix]),
) as Record<string, string>;

/** Characters that can extend an arrow digraph — revert rather than leave a lone glyph. */
const REVERT_TRIGGERS = new Set(["-", "<", ">"]);

function canSubstituteSuffix(text: string, suffix: string): boolean {
  if (!text.endsWith(suffix)) return false;
  const index = text.length - suffix.length;
  if (index === 0) return true;
  const before = text[index - 1]!;
  switch (suffix) {
    case "-->":
      return before !== "-";
    case "<--":
      return before !== "-" && before !== "<";
    case "<->":
      return before !== "-" && before !== "<" && before !== ">";
    default:
      return true;
  }
}

function isInCodeContext($pos: ResolvedPos): boolean {
  if ($pos.parent.type.spec.code) return true;
  return !!(($pos.nodeBefore ?? $pos.nodeAfter)?.marks.some((mark) => mark.type.spec.code));
}

/**
 * Typographic arrows typed as ASCII digraphs/trigraphs (`-->`, `<--`, `<->`).
 * Skipped automatically inside code blocks and inline code (TipTap input rules).
 * Typing `-`, `<`, or `>` immediately after an arrow expands it back to ASCII.
 * `-->` is not substituted when preceded by `-` (e.g. `--->` stays literal).
 */
export const ArrowSubstitutions = Extension.create({
  name: "arrowSubstitutions",

  addInputRules() {
    return [
      new InputRule({
        find: (text) => {
          for (const { suffix } of ARROW_SUFFIXES) {
            if (!canSubstituteSuffix(text, suffix)) continue;
            return {
              index: text.length - suffix.length,
              text: suffix,
            };
          }
          return null;
        },
        handler: ({ state, range, match }) => {
          const suffix = match[0];
          const replacement = ARROW_SUFFIXES.find((entry) => entry.suffix === suffix);
          if (!replacement) return;
          state.tr.insertText(replacement.arrow, range.from, range.to);
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, to, text) {
            if (text.length !== 1 || from !== to || !REVERT_TRIGGERS.has(text)) {
              return false;
            }

            const $from = view.state.doc.resolve(from);
            if (isInCodeContext($from)) return false;

            const nodeBefore = $from.nodeBefore;
            if (!nodeBefore?.isText) return false;

            const textBefore = nodeBefore.text;
            if (!textBefore) return false;

            const lastChar = textBefore.at(-1);
            if (!lastChar) return false;

            const source = ARROW_TO_SOURCE[lastChar];
            if (!source) return false;

            view.dispatch(
              view.state.tr.insertText(source + text, from - 1, from),
            );
            return true;
          },
        },
      }),
    ];
  },
});

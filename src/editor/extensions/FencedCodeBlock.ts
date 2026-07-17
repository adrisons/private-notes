import CodeBlock from "@tiptap/extension-code-block";
import { textblockTypeInputRule } from "@tiptap/core";

/**
 * Code blocks fenced with ```. The stock input rule waits for trailing
 * whitespace; we convert as soon as the closing backtick is typed.
 */
export const FencedCodeBlock = CodeBlock.extend({
  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^```([a-z]+)?$/,
        type: this.type,
        getAttributes: (match) => ({
          language: match[1] ?? null,
        }),
      }),
    ];
  },
});

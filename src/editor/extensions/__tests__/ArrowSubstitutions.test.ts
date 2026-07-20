import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { ArrowSubstitutions } from "../ArrowSubstitutions";

function createEditor(content = "<p></p>"): Editor {
  return new Editor({
    extensions: [StarterKit, ArrowSubstitutions],
    content,
  });
}

function typeText(editor: Editor, text: string): void {
  const { view } = editor;
  for (const char of text) {
    const { state } = view;
    const { from, to } = state.selection;
    const handled = view.someProp("handleTextInput", (handler) =>
      handler(view, from, to, char, () =>
        state.tr.insertText(char, from, to),
      ),
    );
    if (!handled) {
      view.dispatch(state.tr.insertText(char, from, to));
    }
  }
}

function paragraphText(editor: Editor): string {
  return editor.state.doc.firstChild?.textContent ?? "";
}

describe("ArrowSubstitutions", () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it.each([
    ["-->", "→"],
    ["<--", "←"],
    ["<->", "↔"],
  ] as const)("converts %s to %s", (sequence, arrow) => {
    editor = createEditor();
    typeText(editor, sequence);
    expect(paragraphText(editor)).toBe(arrow);
  });

  it("leaves partial sequences unchanged until complete", () => {
    editor = createEditor();
    typeText(editor, "--");
    expect(paragraphText(editor)).toBe("--");
  });

  it("does not substitute inside inline code", () => {
    editor = createEditor();
    editor.commands.toggleCode();
    typeText(editor, "-->");
    expect(editor.state.doc.textContent).toBe("-->");
  });

  it("does not substitute inside code blocks", () => {
    editor = createEditor();
    editor.commands.setCodeBlock();
    typeText(editor, "-->");
    expect(paragraphText(editor)).toBe("-->");
  });

  it("does not substitute arrow suffixes embedded in longer dash runs", () => {
    editor = createEditor();
    // Prefix avoids the standalone `---` horizontal-rule input rule.
    typeText(editor, "x---->");
    expect(paragraphText(editor)).toBe("x---->");

    editor.destroy();
    editor = createEditor();
    typeText(editor, "x--->");
    expect(paragraphText(editor)).toBe("x--->");
  });

  it("expands an arrow when a sequence character is typed after it", () => {
    editor = createEditor();
    typeText(editor, "-->-");
    expect(paragraphText(editor)).toBe("-->-");
  });

  it("allows longer dash sequences after a premature substitution", () => {
    editor = createEditor();
    typeText(editor, "-->---");
    expect(paragraphText(editor)).toBe("-->---");
  });

  it("keeps the arrow when a non-sequence character follows", () => {
    editor = createEditor();
    typeText(editor, "--> ");
    expect(paragraphText(editor)).toBe("→ ");
  });
});

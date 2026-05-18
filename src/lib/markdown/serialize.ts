import type { PMDoc, PMMark, PMTextNode } from "./types";

/**
 * Order in which marks are applied from the outside in. Markdown does not care
 * about nesting order, but a stable serialization keeps diffs small.
 */
const MARK_ORDER: PMMark["type"][] = [
  "bold",
  "italic",
  "strike",
  "underline",
];

function wrapText(text: string, marks: PMMark["type"][]): string {
  let out = text;
  // Apply from inside out so the outermost mark in MARK_ORDER ends up outermost.
  for (let i = MARK_ORDER.length - 1; i >= 0; i--) {
    const m = MARK_ORDER[i]!;
    if (!marks.includes(m)) continue;
    switch (m) {
      case "bold":
        out = `**${out}**`;
        break;
      case "italic":
        out = `*${out}*`;
        break;
      case "strike":
        out = `~~${out}~~`;
        break;
      case "underline":
        out = `<u>${out}</u>`;
        break;
    }
  }
  return out;
}

function serializeText(node: PMTextNode): string {
  const marks = (node.marks ?? []).map((m) => m.type);
  // Trailing/leading whitespace inside a mark would break some renderers
  // ("**hello **" reads as literal asterisks). Move whitespace outside.
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(node.text);
  const [, lead = "", core = "", tail = ""] = match ?? [];
  if (core.length === 0) return node.text;
  return `${lead}${wrapText(core, marks)}${tail}`;
}

export function serializeDoc(doc: PMDoc): string {
  const paragraphs = (doc.content ?? []).map((p) => {
    if (p.type !== "paragraph") return "";
    return (p.content ?? []).map(serializeText).join("");
  });
  return paragraphs.join("\n\n").replace(/\n+$/, "");
}

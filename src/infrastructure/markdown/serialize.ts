import type {
  PMDoc,
  PMBlockNode,
  PMBlockquoteNode,
  PMBulletListNode,
  PMCodeBlockNode,
  PMHeadingNode,
  PMImageNode,
  PMListItemNode,
  PMMark,
  PMOrderedListNode,
  PMParagraphNode,
  PMTextNode,
} from "./types";

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

function serializeInline(nodes: PMTextNode[]): string {
  return nodes.map(serializeText).join("");
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

function escapeImageAlt(alt: string): string {
  return alt.replace(/\]/g, "\\]");
}

function escapeImageSrc(src: string): string {
  return src.replace(/\)/g, "\\)");
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function serializeAttachmentImage(node: PMImageNode): string {
  const alt = escapeImageAlt(node.attrs.alt ?? "");
  const src = escapeImageSrc(node.attrs.src);
  const width = node.attrs.width;

  if (width && width > 0) {
    return `<img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(alt)}" width="${width}">`;
  }

  return `![${alt}](${src})`;
}

function serializeParagraph(node: PMParagraphNode): string {
  return serializeInline(node.content ?? []);
}

function serializeHeading(node: PMHeadingNode): string {
  const level = Math.min(Math.max(node.attrs.level, 1), 5);
  const prefix = "#".repeat(level);
  return `${prefix} ${serializeInline(node.content ?? [])}`;
}

function serializeCodeBlock(node: PMCodeBlockNode): string {
  const language = node.attrs?.language ?? "";
  const text = (node.content ?? []).map((child) => child.text).join("");
  const opener = language ? `\`\`\`${language}` : "```";
  return `${opener}\n${text}\n\`\`\``;
}

function prefixBlockquoteLines(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? `> ${line}` : ">"))
    .join("\n");
}

function serializeBlockquote(node: PMBlockquoteNode): string {
  const body = (node.content ?? []).map(serializeBlock).join("\n\n");
  return prefixBlockquoteLines(body);
}

function serializeListItem(
  item: PMListItemNode,
  marker: string,
  depth: number,
): string {
  const indent = "  ".repeat(depth);
  const blocks = item.content ?? [];
  const lines: string[] = [];
  let firstParagraph = true;

  for (const block of blocks) {
    if (block.type === "paragraph") {
      const text = serializeInline(block.content ?? []);
      if (firstParagraph) {
        lines.push(`${indent}${marker} ${text}`);
        firstParagraph = false;
      } else {
        lines.push("");
        lines.push(`${indent}    ${text}`);
      }
      continue;
    }

    if (block.type === "bulletList") {
      lines.push(serializeBulletList(block, depth + 1));
      continue;
    }

    if (block.type === "orderedList") {
      lines.push(serializeOrderedList(block, depth + 1));
      continue;
    }

    const nested = serializeBlock(block);
    if (firstParagraph) {
      lines.push(`${indent}${marker} ${nested.replace(/\n/g, `\n${indent}   `)}`);
      firstParagraph = false;
    } else {
      lines.push("");
      lines.push(`${indent}    ${nested.replace(/\n/g, `\n${indent}    `)}`);
    }
  }

  return lines.join("\n");
}

function serializeBulletList(node: PMBulletListNode, depth = 0): string {
  return (node.content ?? [])
    .map((item) => serializeListItem(item, "-", depth))
    .join("\n");
}

function serializeOrderedList(node: PMOrderedListNode, depth = 0): string {
  let index = node.attrs?.start ?? 1;
  return (node.content ?? [])
    .map((item) => {
      const line = serializeListItem(item, `${index}.`, depth);
      index += 1;
      return line;
    })
    .join("\n");
}

function serializeBlock(node: PMBlockNode): string {
  switch (node.type) {
    case "paragraph":
      return serializeParagraph(node);
    case "heading":
      return serializeHeading(node);
    case "codeBlock":
      return serializeCodeBlock(node);
    case "blockquote":
      return serializeBlockquote(node);
    case "bulletList":
      return serializeBulletList(node);
    case "orderedList":
      return serializeOrderedList(node);
    case "horizontalRule":
      return "---";
    case "attachmentImage":
      return serializeAttachmentImage(node);
    default:
      return "";
  }
}

export function serializeDoc(doc: PMDoc): string {
  const blocks = (doc.content ?? []).map(serializeBlock);
  return blocks.join("\n\n").replace(/\n+$/, "");
}

/**
 * The narrow ProseMirror JSON subset we serialize. Working with this typed
 * shape (rather than `any`) keeps the serializer auditable.
 */
export interface PMMark {
  type: "bold" | "italic" | "underline" | "strike";
}

export interface PMTextNode {
  type: "text";
  text: string;
  marks?: PMMark[];
}

export interface PMParagraphNode {
  type: "paragraph";
  content?: PMInlineNode[];
}

export interface PMImageNode {
  type: "attachmentImage";
  attrs: { src: string; alt?: string };
}

export interface PMCodeBlockNode {
  type: "codeBlock";
  attrs?: { language?: string | null };
  content?: PMTextNode[];
}

export type PMInlineNode = PMTextNode;
export type PMBlockNode = PMParagraphNode | PMImageNode | PMCodeBlockNode;

export interface PMDoc {
  type: "doc";
  content?: PMBlockNode[];
}

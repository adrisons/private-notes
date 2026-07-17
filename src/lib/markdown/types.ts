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

export interface PMHeadingNode {
  type: "heading";
  attrs: { level: number };
  content?: PMInlineNode[];
}

export interface PMListItemNode {
  type: "listItem";
  content?: PMBlockNode[];
}

export interface PMBulletListNode {
  type: "bulletList";
  content?: PMListItemNode[];
}

export interface PMOrderedListNode {
  type: "orderedList";
  attrs?: { start?: number };
  content?: PMListItemNode[];
}

export interface PMBlockquoteNode {
  type: "blockquote";
  content?: PMBlockNode[];
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

export interface PMHorizontalRuleNode {
  type: "horizontalRule";
}

export type PMInlineNode = PMTextNode;
export type PMBlockNode =
  | PMParagraphNode
  | PMHeadingNode
  | PMBulletListNode
  | PMOrderedListNode
  | PMBlockquoteNode
  | PMImageNode
  | PMCodeBlockNode
  | PMHorizontalRuleNode;

export interface PMDoc {
  type: "doc";
  content?: PMBlockNode[];
}

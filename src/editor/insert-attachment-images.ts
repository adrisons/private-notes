import type { EditorView } from "@tiptap/pm/view";
import { defaultAttachmentImageWidth } from "./attachment-image-size";

/** Upload clipboard/dropped image files and insert them as attachment nodes. */
export async function insertAttachmentImages(
  view: EditorView,
  files: File[],
  upload: (file: File) => Promise<string>,
  insertPos?: number,
): Promise<void> {
  const nodeType = view.state.schema.nodes.attachmentImage;
  if (!nodeType) return;

  let pos = insertPos ?? view.state.selection.from;

  for (const file of files) {
    try {
      const [src, width] = await Promise.all([
        upload(file),
        defaultAttachmentImageWidth(file),
      ]);
      const node = nodeType.create({ src, alt: "", width });
      const transaction = view.state.tr.insert(pos, node);
      view.dispatch(transaction);
      pos += node.nodeSize;
    } catch {
      // useAttachments already surfaces upload failures via onError.
      break;
    }
  }
}

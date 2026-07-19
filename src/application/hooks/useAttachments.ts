import { useCallback } from "react";
import { noteId } from "../../domain";
import { guardNoteIO } from "../errors";
import type { VaultSession } from "../vault-session";

export interface UseAttachmentsOptions {
  session: VaultSession | null;
  currentNoteId: string | null;
  onError: (error: unknown) => void;
}

export interface UseAttachmentsResult {
  onUploadImage: (file: File) => Promise<string>;
  resolveImageSrc: (src: string) => Promise<string | null>;
}

export function useAttachments({
  session,
  currentNoteId,
  onError,
}: UseAttachmentsOptions): UseAttachmentsResult {
  const onUploadImage = useCallback(
    async (file: File): Promise<string> => {
      if (!session || !currentNoteId) throw new Error("No active note");
      try {
        return await guardNoteIO(
          {
            operation: "upload-attachment",
            module: "application/hooks/useAttachments.ts",
            trace:
              "onUploadImage → FsAttachmentStore.store → addRef (attachment-refs.json)",
            fixHint:
              "Check storeAttachment in infrastructure/attachments/storage.ts and addRef in refs.ts.",
            details: { fileName: file.name, noteId: currentNoteId },
          },
          "Could not attach this image.",
          "Try a smaller image or check that the folder is still writable.",
          async () => {
            const { path } = await session.attachments.store(file);
            await session.attachments.addRef(noteId(currentNoteId), path);
            return path;
          },
        );
      } catch (error) {
        onError(error);
        throw error;
      }
    },
    [session, currentNoteId, onError],
  );

  const resolveImageSrc = useCallback(
    async (src: string): Promise<string | null> => {
      if (!session) return null;
      return session.attachments.resolve(src);
    },
    [session],
  );

  return { onUploadImage, resolveImageSrc };
}

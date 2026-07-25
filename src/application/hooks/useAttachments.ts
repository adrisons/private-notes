import { useCallback } from "react";
import { noteId } from "../../domain";
import { AttachmentRejectedError } from "../../lib/attachment-errors";
import { guardVaultIO, VaultIOError } from "../errors";
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
        return await guardVaultIO(
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
        const cause =
          error instanceof VaultIOError ? error.cause : error;
        if (cause instanceof AttachmentRejectedError) {
          const vaultError = new VaultIOError(
            cause.message,
            {
              operation: "upload-attachment",
              module: "application/hooks/useAttachments.ts",
              trace:
                "onUploadImage → storeAttachment (attachment rejected before write)",
              fixHint: cause.fixHint,
              details: { fileName: file.name, noteId: currentNoteId },
            },
            cause.fixHint,
            cause,
          );
          onError(vaultError);
          throw vaultError;
        }
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

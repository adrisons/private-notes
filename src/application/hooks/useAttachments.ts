import { useCallback } from "react";
import { noteId } from "../../domain";
import type { VaultSession } from "../vault-session";

export interface UseAttachmentsOptions {
  session: VaultSession | null;
  currentNoteId: string | null;
}

export interface UseAttachmentsResult {
  onUploadImage: (file: File) => Promise<string>;
  resolveImageSrc: (src: string) => Promise<string | null>;
}

export function useAttachments({
  session,
  currentNoteId,
}: UseAttachmentsOptions): UseAttachmentsResult {
  const onUploadImage = useCallback(
    async (file: File): Promise<string> => {
      if (!session || !currentNoteId) throw new Error("No active note");
      const { path } = await session.attachments.store(file);
      await session.attachments.addRef(noteId(currentNoteId), path);
      return path;
    },
    [session, currentNoteId],
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

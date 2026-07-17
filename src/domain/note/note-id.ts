/** Branded id so note ids are not confused with paths or arbitrary strings. */
export type NoteId = string & { readonly __brand: unique symbol };

export function noteId(value: string): NoteId {
  return value as NoteId;
}

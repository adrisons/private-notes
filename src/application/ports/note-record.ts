/** Persistence DTO for index/reindex — not a domain entity. */
export interface NoteRecord {
  id: string;
  title: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  spaceIds?: string;
}

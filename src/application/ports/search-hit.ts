import type { MatchKind } from "../../domain";

/** Semantic search hit at the application boundary. */
export interface SearchHit {
  noteId: string;
  filePath: string;
  chunkIdx: number;
  score: number;
  snippet: string;
  offset: number;
  length: number;
  matchKind: MatchKind;
}

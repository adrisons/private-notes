import type { MatchKind } from "../../domain";

/** Semantic search hit at the application boundary. */
export interface SearchHit {
  noteId: string;
  score: number;
  matchKind: MatchKind;
}

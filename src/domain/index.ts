export { noteId, type NoteId } from "./note/note-id";
export { type NoteSummary } from "./note/note-summary";
export { noteToSummary, type Note } from "./note/note";
export {
  parseNote,
  serializeNote,
  FrontmatterError,
  type NoteFrontmatter,
  type ParsedNote,
} from "./note/frontmatter";
export { slugify } from "./note/slug";
export { pickMostRecent, sortSummariesByRecency } from "./vault/vault";
export {
  NoteNotFoundError,
  VaultDataError,
  VaultIncompatibleError,
  type VaultIncompatibleCode,
} from "./vault/vault-errors";
export {
  computeReconcileDiff,
  dedupeRecordsById,
  indexSnapshotChanged,
  sortRecordsById,
  type ReconcileDiff,
  type ReconcileRecord,
} from "./vault/reconcile-policy";
export {
  WELCOME_NOTE_BODY,
  WELCOME_NOTE_TITLE,
} from "./vault/welcome-note";
export {
  SPACE_COLOR_IDS,
  isSpaceColorId,
  parseSpaceColorId,
  type SpaceColorId,
} from "./space/space-color";
export {
  GENERAL_SPACE_ID,
  isGeneralSpaceId,
  spaceId,
  type SpaceId,
} from "./space/space-id";
export {
  GENERAL_SPACE,
  GENERAL_SPACE_DESCRIPTION,
} from "./space/general-space";
export { SpaceValidationError } from "./space/space-error";
export {
  applySpacePatch,
  assertValidSpaceName,
  createSpaceDraft,
  FALLBACK_SPACE_NAME,
  isCustomSpaceId,
  isDuplicateSpaceName,
  isReservedSpaceName,
  DUPLICATE_SPACE_NAME_MESSAGE,
  RESERVED_SPACE_NAME_MESSAGE,
  type CustomSpace,
  type Space,
  type SpaceDraft,
  type SpacePatch,
} from "./space/space";
export {
  parseSpaceIds,
  serializeSpaceIds,
  noteBelongsToSpace,
  addSpaceId,
  removeSpaceId,
} from "./space/space-ids";
export {
  foldInflection,
  foldSearchText,
  tokenizeSearchText,
} from "./search/normalize";
export {
  buildLexicalIndex,
  searchLexicalIndex,
  type LexicalDocument,
  type LexicalIndex,
  type LexicalMatch,
} from "./search/lexical-index";
export {
  applyRelativeCutoff,
  DEFAULT_RELATIVE_CUTOFF,
  fuseRankings,
  rankNotes,
  RELEVANCE_BONUS,
  spaceSignal,
  titleBonus,
  type ContentHit,
  type MatchKind,
  type RankableNote,
  type RankedNote,
  type SpaceSignal,
} from "./search/rank";

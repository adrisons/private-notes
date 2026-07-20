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
  resolveSpaceId,
  spaceId,
  type SpaceId,
} from "./space/space-id";
export {
  GENERAL_SPACE,
  GENERAL_SPACE_DESCRIPTION,
  isReservedSpaceName,
  type Space,
} from "./space/general-space";
export { type CustomSpace, isCustomSpaceId } from "./space/space";
export {
  parseSpaceIds,
  serializeSpaceIds,
  migrateLegacySpaceField,
  noteBelongsToSpace,
  addSpaceId,
  removeSpaceId,
} from "./space/space-ids";

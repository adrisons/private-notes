/** Application wiring — the only entry hooks use to reach infrastructure defaults. */
export {
  createAttachmentStore,
  createNoteRepository,
  createSemanticSearch,
  defaultInfrastructure,
} from "../../infrastructure/composition/default-deps";

export type { InfrastructureDefaults } from "../../infrastructure/composition/default-deps";

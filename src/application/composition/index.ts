export {
  createAttachmentStore,
  createNoteRepository,
  createSemanticSearch,
  defaultInfrastructure,
} from "../../infrastructure/composition/default-deps";

export { loadDefaultEmbedder } from "./load-embedder";

export type { InfrastructureDefaults } from "../../infrastructure/composition/default-deps";

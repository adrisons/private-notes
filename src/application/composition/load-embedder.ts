import type { Embedder } from "../ports/embedder";

/** Lazy-load the production embedder (Web Worker + transformers.js). */
export async function loadDefaultEmbedder(): Promise<Embedder> {
  const { TransformersEmbedder, DEFAULT_MODEL } = await import(
    "../../infrastructure/search/transformers-embedder"
  );
  const embedder = new TransformersEmbedder(DEFAULT_MODEL);
  await embedder.ready();
  return embedder;
}

/**
 * Instruction prefixes for asymmetric retrieval models (E5, BGE and friends).
 * Those models are trained on `query: …` / `passage: …` pairs and lose real
 * accuracy without them, while symmetric models must not see them at all — so
 * the convention belongs to the model, not to the call site.
 */
export interface EmbedderPrefixes {
  query: string;
  passage: string;
}

/** Embedder port — implemented in infrastructure/search. */
export interface Embedder {
  readonly id: string;
  readonly dimensions: number;
  /** Omitted by symmetric models, which take the raw text. */
  readonly prefixes?: EmbedderPrefixes;
  /**
   * Cosine floor below which this model's scores carry no signal. Model-
   * specific: E5-style models pack every pair into a narrow high band, so a
   * floor that is meaningful for one model is a rubber stamp for another.
   */
  readonly minScore?: number;
  embed(texts: string[]): Promise<number[][]>;
}

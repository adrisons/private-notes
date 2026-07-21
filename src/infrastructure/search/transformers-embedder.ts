import type { Embedder, EmbedderPrefixes } from "./embedder";

/** Everything about a model that the rest of the app has to know. */
export interface ModelProfile {
  id: string;
  prefixes?: EmbedderPrefixes;
  minScore?: number;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

interface WorkerReply {
  id: number;
  type: "ready" | "embedded" | "error";
  data?: number[][];
  dimensions?: number;
  error?: string;
}

/**
 * Embedder backed by a Web Worker that runs transformers.js. The worker
 * downloads the model from the Hugging Face CDN on first use and caches it
 * in the browser; subsequent sessions are fully offline.
 *
 * `dimensions` is detected from a probe inference at init time, so the value
 * declared here matches whatever the model actually emits.
 */
export class TransformersEmbedder implements Embedder {
  readonly id: string;
  readonly prefixes?: EmbedderPrefixes;
  readonly minScore?: number;
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private readyPromise: Promise<void>;
  private _dimensions = 0;

  constructor(model: ModelProfile, device: "webgpu" | "wasm" = "wasm") {
    const modelId = model.id;
    this.id = modelId;
    this.prefixes = model.prefixes;
    this.minScore = model.minScore;
    this.worker = new Worker(
      new URL("../../workers/embedder.worker.ts", import.meta.url),
      { type: "module", name: `embedder:${modelId}` },
    );
    this.worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      const reply = e.data;
      const slot = this.pending.get(reply.id);
      if (!slot) return;
      this.pending.delete(reply.id);
      if (reply.type === "error") {
        slot.reject(new Error(reply.error ?? "worker error"));
      } else if (reply.type === "ready") {
        this._dimensions = reply.dimensions ?? 0;
        slot.resolve(undefined);
      } else {
        slot.resolve(reply.data);
      }
    };
    this.readyPromise = this.send("init", { modelId, device }).then(() => {});
  }

  get dimensions(): number {
    return this._dimensions;
  }

  async ready(): Promise<void> {
    await this.readyPromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    await this.readyPromise;
    const data = (await this.send("embed", { texts })) as number[][];
    return data;
  }

  terminate(): void {
    this.worker.terminate();
  }

  private send(type: string, payload: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload });
    });
  }
}

/**
 * Default multilingual model — 384 dimensions, ~120 MB quantized, Spanish and
 * English both first-class.
 *
 * E5 rather than the older `paraphrase-multilingual-MiniLM`: paraphrase models
 * are trained on sentence *pairs of comparable length*, and we ask the
 * opposite question — a two-word query against a whole recipe. E5 is trained
 * for exactly that shape, which is what the `query:` / `passage:` prefixes
 * select; without them the model is measurably worse, so they are declared
 * here rather than at the call sites (ADR-003).
 *
 * `minScore` is the floor below which this model's cosines mean nothing. E5
 * packs unrelated pairs into roughly 0.72–0.80 and good ones into 0.85+, so
 * the floor is high by MiniLM standards and still leaves the relative cutoff
 * doing most of the filtering.
 */
export const DEFAULT_MODEL: ModelProfile = {
  id: "Xenova/multilingual-e5-small",
  prefixes: { query: "query: ", passage: "passage: " },
  minScore: 0.75,
};

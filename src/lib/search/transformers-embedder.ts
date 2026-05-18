import type { Embedder } from "./embedder";

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
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private readyPromise: Promise<void>;
  private _dimensions = 0;

  constructor(modelId: string, device: "webgpu" | "wasm" = "wasm") {
    this.id = modelId;
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

/** Default multilingual model (~120 MB quantized; covers Spanish + English). */
export const DEFAULT_MODEL_ID = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

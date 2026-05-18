/// <reference lib="webworker" />
/**
 * Embedding worker. Hosts a transformers.js feature-extraction pipeline so
 * inference never blocks the main thread. The model is downloaded from the
 * Hugging Face CDN on first use and cached by the browser; subsequent loads
 * are offline.
 */
import { pipeline, env } from "@huggingface/transformers";

// `pipeline()` returns a giant union; we narrow it locally to the call shape
// we use. This avoids "expression too complex" errors without losing safety.
type FeatureExtractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

// Trust the HF CDN as the only model source. We disable filesystem lookups
// so a misconfigured base URL cannot leak file:// requests in development.
env.allowLocalModels = false;

interface InitMessage {
  id: number;
  type: "init";
  payload: { modelId: string; device?: "webgpu" | "wasm" };
}

interface EmbedMessage {
  id: number;
  type: "embed";
  payload: { texts: string[] };
}

type IncomingMessage = InitMessage | EmbedMessage;

let extractor: FeatureExtractor | null = null;

async function ensurePipeline(
  modelId: string,
  device: "webgpu" | "wasm" = "wasm",
): Promise<FeatureExtractor> {
  if (!extractor) {
    extractor = (await pipeline("feature-extraction", modelId, {
      device,
    })) as unknown as FeatureExtractor;
  }
  return extractor;
}

self.addEventListener("message", async (event: MessageEvent<IncomingMessage>) => {
  const msg = event.data;
  try {
    if (msg.type === "init") {
      const pipe = await ensurePipeline(msg.payload.modelId, msg.payload.device);
      // Probe a tiny string to discover the output dimensionality up front.
      const probe = await pipe(["a"], { pooling: "mean", normalize: true });
      const first = probe.tolist()[0] ?? [];
      self.postMessage({
        id: msg.id,
        type: "ready",
        dimensions: first.length,
      });
      return;
    }
    if (msg.type === "embed") {
      if (!extractor) throw new Error("Pipeline not initialized");
      const out = await extractor(msg.payload.texts, {
        pooling: "mean",
        normalize: true,
      });
      self.postMessage({ id: msg.id, type: "embedded", data: out.tolist() });
      return;
    }
  } catch (err) {
    self.postMessage({
      id: msg.id,
      type: "error",
      error: (err as Error).message,
    });
  }
});

export {};

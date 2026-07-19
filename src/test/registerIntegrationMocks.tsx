import { vi } from "vitest";

vi.mock("../lib/compatibility", () => ({
  getCompatibility: () => ({ supported: true, reasons: [], webgpu: false }),
}));

vi.mock("../infrastructure/fs/permissions", () => ({
  ensureReadWritePermission: vi.fn().mockResolvedValue(undefined),
  hasReadWritePermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("../infrastructure/search/transformers-embedder", async () => {
  const { FakeEmbedder } = await import("../infrastructure/search/embedder");
  class MockTransformersEmbedder extends FakeEmbedder {
    async ready(): Promise<void> {}
  }
  return {
    TransformersEmbedder: MockTransformersEmbedder,
    DEFAULT_MODEL_ID: "fake-hash-32",
  };
});

vi.mock("../editor/Editor", () => ({
  Editor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      aria-label="note body"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

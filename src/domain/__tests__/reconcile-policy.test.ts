import { describe, expect, it } from "vitest";
import {
  computeReconcileDiff,
  dedupeRecordsById,
  indexSnapshotChanged,
  sortRecordsById,
  type ReconcileRecord,
} from "../vault/reconcile-policy";

const a: ReconcileRecord = {
  id: "01A",
  title: "A",
  path: "notes/a.md",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const b: ReconcileRecord = {
  id: "01B",
  title: "B",
  path: "notes/b.md",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
};

describe("reconcile-policy", () => {
  it("sorts records by id", () => {
    expect(sortRecordsById([b, a]).map((r) => r.id)).toEqual(["01A", "01B"]);
  });

  it("dedupes by id keeping the newest updatedAt", () => {
    const older = { ...a, updatedAt: "2026-01-01T00:00:00.000Z" };
    const newer = { ...a, title: "Newer", updatedAt: "2026-01-05T00:00:00.000Z" };
    expect(dedupeRecordsById([older, newer])).toEqual([newer]);
  });

  it("computes added and removed counts", () => {
    const prior = new Set(["01A"]);
    const next = new Set(["01A", "01B"]);
    expect(computeReconcileDiff(prior, next)).toEqual({ added: 1, removed: 0 });
  });

  it("detects index snapshot changes", () => {
    expect(indexSnapshotChanged(false, [], [])).toBe(true);
    expect(indexSnapshotChanged(true, [a], [a])).toBe(false);
    expect(indexSnapshotChanged(true, [a], [b])).toBe(true);
  });
});

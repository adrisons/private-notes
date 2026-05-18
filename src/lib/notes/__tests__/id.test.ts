import { describe, it, expect } from "vitest";
import { ulid, ulidTime } from "../id";

describe("ulid", () => {
  it("produces 26-char strings", () => {
    expect(ulid({ time: 0, rand: () => 0 })).toHaveLength(26);
  });

  it("encodes the timestamp into the first 10 chars", () => {
    const id = ulid({ time: 1_700_000_000_000, rand: () => 0 });
    expect(ulidTime(id)).toBe(1_700_000_000_000);
  });

  it("sorts lexicographically by time", () => {
    const a = ulid({ time: 1_000, rand: () => 0 });
    const b = ulid({ time: 2_000, rand: () => 0 });
    expect(a < b).toBe(true);
  });
});

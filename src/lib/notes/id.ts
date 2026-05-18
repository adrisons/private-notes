/**
 * ULID generator. 26 base32 (Crockford) chars: 10 chars of timestamp followed
 * by 16 chars of randomness. Lexicographic order matches time order.
 *
 * Implementation is intentionally tiny — we only use ULIDs as opaque IDs.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(time: number, length: number): string {
  let out = "";
  for (let i = length - 1; i >= 0; i--) {
    const mod = time % 32;
    out = ALPHABET[mod] + out;
    time = (time - mod) / 32;
  }
  return out;
}

function encodeRandom(length: number, rand: () => number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(rand() * 32)];
  }
  return out;
}

export interface UlidOptions {
  /** Unix millis. Defaults to `Date.now()`. */
  time?: number;
  /** Injectable source of randomness, for tests. Returns a value in [0, 1). */
  rand?: () => number;
}

export function ulid(options: UlidOptions = {}): string {
  const time = options.time ?? Date.now();
  const rand = options.rand ?? Math.random;
  return encodeTime(time, 10) + encodeRandom(16, rand);
}

/** Recover the millisecond timestamp encoded in a ULID's first 10 chars. */
export function ulidTime(id: string): number {
  if (id.length < 10) throw new Error("Not a ULID");
  let n = 0;
  for (let i = 0; i < 10; i++) {
    const idx = ALPHABET.indexOf(id[i]!);
    if (idx === -1) throw new Error("Invalid ULID character");
    n = n * 32 + idx;
  }
  return n;
}

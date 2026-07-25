/**
 * Bounded parallelism for File System Access reads.
 *
 * A vault walk is I/O-bound and the FSA API parallelises reads happily, so a
 * serial pass spends most of a large vault idle. An unbounded `Promise.all`
 * over every note is the other failure mode: it resolves thousands of handles
 * at once and the browser serialises them anyway, with the memory of every
 * intermediate result held live. A fixed pool sits between the two.
 */

/** Reads to keep in flight when walking the whole vault. */
export const VAULT_READ_CONCURRENCY = 12;

/**
 * Map with a fixed pool of workers pulling from a shared cursor, preserving
 * input order in the result so downstream passes and progress reporting stay
 * deterministic.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!, index);
    }
  };
  const size = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: size }, () => worker()));
  return results;
}

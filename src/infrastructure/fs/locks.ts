/**
 * Cross-tab serialization for the vault index.
 *
 * `.private-notes/index.json` is mutated read-modify-write. Two tabs open on the
 * same vault would otherwise race and last-write-wins, silently dropping the
 * other tab's change. We wrap every index mutation in a Web Lock so the RMW
 * sections run one at a time across the whole origin.
 *
 * A single origin-wide lock name is enough: correctness only requires that two
 * tabs editing the *same* vault agree on the name. Two tabs on *different*
 * vaults will occasionally serialize needlessly, which is harmless.
 *
 * Where the Web Locks API is unavailable (older Safari, the test environment)
 * we fall back to running the critical section directly — no cross-tab
 * protection, but identical single-tab behavior.
 */
const INDEX_LOCK = "private-notes:index";

interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

function getLockManager(): LockManagerLike | null {
  const locks = (
    globalThis.navigator as Navigator & { locks?: LockManagerLike }
  )?.locks;
  return locks ?? null;
}

/** Run `fn` while holding the exclusive vault-index lock. */
export function withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = getLockManager();
  if (!locks) return fn();
  return locks.request(INDEX_LOCK, fn);
}

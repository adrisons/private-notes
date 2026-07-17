import type { VaultSession } from "../vault-session";

/** Tear down session-scoped caches (attachment blob URLs). */
export function closeVault(session: VaultSession): void {
  session.dispose();
}

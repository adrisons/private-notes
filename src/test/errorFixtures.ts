import { VaultIOError, type ErrorDebugContext } from "../application/errors";

/** Build a VaultIOError for tests with consistent debug metadata. */
export function vaultIOError(
  operation: string,
  message: string,
  userFixHint: string,
  cause: unknown = new Error("test failure"),
): VaultIOError {
  const debug: ErrorDebugContext = {
    operation,
    module: `application/use-cases/${operation}.ts`,
    trace: `${operation} → test`,
    fixHint: `Inspect ${operation} in tests.`,
  };
  return new VaultIOError(message, debug, userFixHint, cause);
}

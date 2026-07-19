import { NoteIOError, type ErrorDebugContext } from "../application/errors";

/** Build a NoteIOError for tests with consistent debug metadata. */
export function noteIOError(
  operation: string,
  message: string,
  userFixHint: string,
  cause: unknown = new Error("test failure"),
): NoteIOError {
  const debug: ErrorDebugContext = {
    operation,
    module: `application/use-cases/${operation}.ts`,
    trace: `${operation} → test`,
    fixHint: `Inspect ${operation} in tests.`,
  };
  return new NoteIOError(message, debug, userFixHint, cause);
}

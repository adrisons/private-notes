/** Typed application errors with user vs background classification. */

export type AppErrorKind = "user" | "background";

export type BackgroundTask = "reindex" | "attachment-cache" | "attachment-refs";

export interface ErrorDebugContext {
  /** Short label for the failing operation, e.g. "save-note". */
  operation: string;
  /** Source module path for engineers, e.g. "application/use-cases/save-note.ts". */
  module: string;
  /** Call chain hint, e.g. "saveNote → VaultSession.saveNote → FsNoteRepository.update". */
  trace: string;
  /** Actionable fix for developers reading the console log. */
  fixHint: string;
  details?: Record<string, unknown>;
}

export interface UserErrorPayload {
  message: string;
  fixHint: string;
}

export class VaultError extends Error {
  readonly kind: AppErrorKind;
  readonly fixHint: string;
  readonly debug: ErrorDebugContext;
  readonly cause: unknown;

  constructor(
    message: string,
    kind: AppErrorKind,
    debug: ErrorDebugContext,
    fixHint: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "VaultError";
    this.kind = kind;
    this.fixHint = fixHint;
    this.debug = debug;
    this.cause = cause;
    if (cause instanceof Error && cause.stack) {
      this.stack = cause.stack;
    }
  }
}

export class NoteIOError extends VaultError {
  constructor(
    message: string,
    debug: ErrorDebugContext,
    fixHint: string,
    cause?: unknown,
  ) {
    super(message, "user", debug, fixHint, cause);
    this.name = "NoteIOError";
  }
}

export class BackgroundTaskError extends VaultError {
  readonly task: BackgroundTask;

  constructor(
    task: BackgroundTask,
    message: string,
    debug: ErrorDebugContext,
    fixHint: string,
    cause?: unknown,
  ) {
    super(message, "background", debug, fixHint, cause);
    this.name = "BackgroundTaskError";
    this.task = task;
  }
}

export type AppError = VaultError | NoteIOError | BackgroundTaskError;

export type Result<T, E extends AppError = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

const backgroundLog = new Set<string>();
let backgroundErrorListener: ((error: BackgroundTaskError) => void) | null =
  null;

/** Subscribe to background task failures (e.g. IndexStatus in useSemanticIndex). */
export function setBackgroundErrorListener(
  listener: ((error: BackgroundTaskError) => void) | null,
): void {
  backgroundErrorListener = listener;
}

const BACKGROUND_FIX_HINTS: Record<BackgroundTask, string> = {
  reindex:
    "Inspect run-full-reindex.ts and fs-semantic-search.ts; confirm the embedder worker loaded; retry via IndexStatus.onReindex.",
  "attachment-cache":
    "Inspect AttachmentURLCache.load in infrastructure/attachments/cache.ts; verify the file exists and read permission is granted.",
  "attachment-refs":
    "Inspect addRef/syncRefsForBodyChange in infrastructure/attachments/refs.ts; validate attachment-refs.json.",
};

function causeMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  return "Unknown error";
}

/** Structured console.error for engineers — includes module, trace, and fix hints. */
export function logTechnicalError(
  label: string,
  error: VaultError,
): void {
  const { debug, cause } = error;
  console.error(
    `[private-notes] ${label}`,
    {
      operation: debug.operation,
      module: debug.module,
      trace: debug.trace,
      message: error.message,
      fixHint: debug.fixHint,
      userFixHint: error.fixHint,
      ...(debug.details ? { details: debug.details } : {}),
      ...(cause instanceof Error
        ? { cause: cause.message, causeName: cause.name }
        : cause !== undefined
          ? { cause }
          : {}),
    },
    cause instanceof Error ? cause : undefined,
  );
}

/** Log a user-facing failure and return payload for the toast. */
export function reportUserError(error: unknown): UserErrorPayload {
  if (error instanceof NoteIOError) {
    logTechnicalError("NoteIOError", error);
    return { message: error.message, fixHint: error.fixHint };
  }
  if (error instanceof VaultError && error.kind === "user") {
    logTechnicalError(error.name, error);
    return { message: error.message, fixHint: error.fixHint };
  }
  const message = userFacingMessage(error);
  const fixHint = "Try again. If it keeps failing, reopen the folder.";
  console.error("[private-notes] Unhandled user error", {
    message,
    fixHint,
    cause: causeMessage(error),
  }, error instanceof Error ? error : undefined);
  return { message, fixHint };
}

const backgroundUserMessages: Record<BackgroundTask, string> = {
  reindex: "Search index failed to update.",
  "attachment-cache": "An attachment could not be loaded.",
  "attachment-refs": "Attachment references could not be saved.",
};

/** Non-fatal background failures — log once per task+message and notify listener. */
export function registerBackgroundError(
  task: BackgroundTask,
  cause: unknown,
  debug: Partial<ErrorDebugContext> = {},
): BackgroundTaskError {
  const message = causeMessage(cause);
  const error = new BackgroundTaskError(
    task,
    backgroundUserMessages[task],
    {
      operation: debug.operation ?? task,
      module: debug.module ?? "application/errors.ts",
      trace: debug.trace ?? `registerBackgroundError("${task}")`,
      fixHint: debug.fixHint ?? BACKGROUND_FIX_HINTS[task],
      details: debug.details,
    },
    BACKGROUND_FIX_HINTS[task],
    cause,
  );
  const key = `${task}:${message}`;
  if (!backgroundLog.has(key)) {
    backgroundLog.add(key);
    logTechnicalError(`BackgroundTaskError:${task}`, error);
    backgroundErrorListener?.(error);
  }
  return error;
}

export function userFacingMessage(error: unknown): string {
  if (error instanceof VaultError && error.kind === "user") {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export function userFixHint(error: unknown): string {
  if (error instanceof VaultError) return error.fixHint;
  return "Try again. If it keeps failing, reopen the folder.";
}

/** Wrap note I/O with a typed NoteIOError for user toasts and debug logs. */
export async function guardNoteIO<T>(
  debug: ErrorDebugContext,
  userMessage: string,
  fixHint: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw new NoteIOError(userMessage, debug, fixHint, cause);
  }
}

/** Reset dedupe state — for tests only. */
export function resetErrorReportingForTests(): void {
  backgroundLog.clear();
  backgroundErrorListener = null;
}

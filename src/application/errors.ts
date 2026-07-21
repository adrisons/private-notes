/** Typed application errors with user vs background classification. */

import {
  VaultDataError,
  VaultIncompatibleError,
  type VaultIncompatibleCode,
} from "../lib/validate";

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

const OPEN_VAULT_USER_ERRORS: Record<
  VaultIncompatibleCode | "corrupt-data" | "permission-denied" | "generic",
  UserErrorPayload
> = {
  "newer-app-version": {
    message: "This vault was created by a newer version of private-notes.",
    fixHint: "Update the app, then open this folder again.",
  },
  "not-a-vault": {
    message: "This folder is not a private-notes vault.",
    fixHint: "Choose an empty folder or one that already contains your notes.",
  },
  "corrupt-manifest": {
    message: "The vault metadata in this folder looks damaged.",
    fixHint:
      "Check `.private-notes/manifest.json`, restore from a backup if you have one, or choose a different folder.",
  },
  "corrupt-data": {
    message: "A vault file in this folder looks damaged.",
    fixHint:
      "Check `.private-notes/` in the folder, restore from a backup if you have one, or choose a different folder.",
  },
  "permission-denied": {
    message: "Could not access this folder.",
    fixHint:
      "Grant read/write access when the browser asks, then choose the folder again.",
  },
  generic: {
    message: "Could not open this folder.",
    fixHint:
      "Try again. If it keeps failing, choose the folder again and grant read/write access when prompted.",
  },
};

/** Map open-vault infrastructure failures to user-facing copy. */
export function openVaultUserError(cause: unknown): UserErrorPayload {
  if (cause instanceof VaultIncompatibleError) {
    return OPEN_VAULT_USER_ERRORS[cause.code];
  }
  if (cause instanceof VaultDataError) {
    return OPEN_VAULT_USER_ERRORS["corrupt-data"];
  }
  if (
    cause instanceof Error &&
    cause.message === "Folder permission was not granted."
  ) {
    return OPEN_VAULT_USER_ERRORS["permission-denied"];
  }
  return OPEN_VAULT_USER_ERRORS.generic;
}

/** Extract a vault incompatibility cause from an open/repair failure chain. */
export function vaultIncompatibleCause(
  error: unknown,
): VaultIncompatibleError | null {
  if (error instanceof VaultIncompatibleError) return error;
  if (error instanceof VaultIOError && error.cause instanceof VaultIncompatibleError) {
    return error.cause;
  }
  return null;
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

export class VaultIOError extends VaultError {
  constructor(
    message: string,
    debug: ErrorDebugContext,
    fixHint: string,
    cause?: unknown,
  ) {
    super(message, "user", debug, fixHint, cause);
    this.name = "VaultIOError";
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

export type AppError = VaultError | VaultIOError | BackgroundTaskError;

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
  if (error instanceof VaultIOError) {
    logTechnicalError("VaultIOError", error);
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

/** Wrap vault I/O with a typed VaultIOError for user toasts and debug logs. */
export async function guardVaultIO<T>(
  debug: ErrorDebugContext,
  userMessage: string,
  fixHint: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw new VaultIOError(userMessage, debug, fixHint, cause);
  }
}

/** Reset dedupe state — for tests only. */
export function resetErrorReportingForTests(): void {
  backgroundLog.clear();
  backgroundErrorListener = null;
}

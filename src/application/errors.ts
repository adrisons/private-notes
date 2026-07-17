/** Typed application errors with user vs background classification. */

export type AppErrorKind = "user" | "background";

export type BackgroundTask = "reindex" | "attachment-cache" | "attachment-refs";

export class VaultError extends Error {
  readonly kind: AppErrorKind;

  constructor(message: string, kind: AppErrorKind = "user") {
    super(message);
    this.name = "VaultError";
    this.kind = kind;
  }
}

export class NoteIOError extends VaultError {
  constructor(message: string) {
    super(message, "user");
    this.name = "NoteIOError";
  }
}

export class BackgroundTaskError extends VaultError {
  readonly task: BackgroundTask;

  constructor(task: BackgroundTask, message: string, cause?: unknown) {
    super(message, "background");
    this.name = "BackgroundTaskError";
    this.task = task;
    if (cause instanceof Error && cause.stack) {
      this.stack = cause.stack;
    }
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

/** Non-fatal background failures — warn once per task per session. */
export function registerBackgroundError(
  task: BackgroundTask,
  cause: unknown,
): BackgroundTaskError {
  const message =
    cause instanceof Error ? cause.message : "Background task failed";
  const error = new BackgroundTaskError(task, message, cause);
  const key = `${task}:${message}`;
  if (!backgroundLog.has(key)) {
    backgroundLog.add(key);
    console.warn(`[${task}]`, message);
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

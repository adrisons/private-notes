/** Raised when an attachment fails MIME or size checks before vault I/O. */
export class AttachmentRejectedError extends Error {
  readonly fixHint: string;

  constructor(message: string, fixHint: string) {
    super(message);
    this.name = "AttachmentRejectedError";
    this.fixHint = fixHint;
  }
}

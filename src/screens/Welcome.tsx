import { Button } from "../ui/Button";

interface WelcomeProps {
  onPickFolder?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function Welcome({ onPickFolder, disabled, disabledReason }: WelcomeProps) {
  return (
    <section className="mx-auto flex h-full max-w-xl flex-col items-start justify-center gap-6 px-6">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">
          Your notes, on your machine.
        </h1>
        <p className="mt-3 text-[var(--color-muted-foreground)]">
          Choose a folder. The app reads and writes plain Markdown there.
          Search runs locally with a small embedding model — nothing leaves
          this device.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onPickFolder} disabled={disabled}>
          Choose folder
        </Button>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          Requires a Chromium-based browser.
        </span>
      </div>
      {disabled && disabledReason ? (
        <p className="text-sm text-[var(--color-danger)]">{disabledReason}</p>
      ) : null}
    </section>
  );
}

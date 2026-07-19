import { Button } from "../ui/Button";

interface WelcomeProps {
  onPickFolder?: () => void;
  disabledReason?: string;
}

export function Welcome({ onPickFolder, disabledReason }: WelcomeProps) {
  return (
    <section className="u-enter mx-auto flex h-full max-w-xl flex-col items-start justify-center gap-6 px-6">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">
          Your notes, on your machine.
        </h1>
        <p className="mt-3 text-[var(--foreground-muted)]">
          Choose a folder. The app reads and writes plain Markdown there.
          Search runs locally with a small embedding model — nothing leaves
          this device.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onPickFolder}>Choose folder</Button>
        <span className="text-xs text-[var(--foreground-muted)]">
          Requires a Chromium-based browser.
        </span>
      </div>
      {disabledReason ? (
        <p className="text-sm text-[var(--danger)]">{disabledReason}</p>
      ) : null}
    </section>
  );
}

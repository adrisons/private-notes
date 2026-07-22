import { Button } from "../ui/Button";

interface WelcomeProps {
  onPickFolder?: () => void;
  disabledReason?: string;
  /** True when the browser offered a PWA install prompt we can replay. */
  canInstall?: boolean;
  onInstall?: () => void;
}

export function Welcome({
  onPickFolder,
  disabledReason,
  canInstall,
  onInstall,
}: WelcomeProps) {
  return (
    <section className="u-enter mx-auto flex min-h-0 flex-1 max-w-xl flex-col items-start justify-center gap-6 px-6 py-16 sm:py-20">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Your notes, on your machine.
        </h1>
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">
          Choose a folder. The app reads and writes plain Markdown there.
          Search runs locally with a small embedding model — nothing leaves
          this device.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onPickFolder}>Choose folder</Button>
        {canInstall ? (
          <Button variant="secondary" onClick={onInstall}>
            Install app
          </Button>
        ) : null}
        <span className="text-xs text-[var(--foreground-muted)]">
          Works in Chrome, Edge, Brave, Opera, or Arc — on desktop or Android.
        </span>
      </div>
      {disabledReason ? (
        <p className="text-sm text-[var(--danger)]">{disabledReason}</p>
      ) : null}
    </section>
  );
}

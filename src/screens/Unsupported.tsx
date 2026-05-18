interface UnsupportedProps {
  reasons: string[];
}

export function Unsupported({ reasons }: UnsupportedProps) {
  return (
    <section className="mx-auto flex h-full max-w-xl flex-col items-start justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          This browser isn’t supported yet.
        </h1>
        <p className="mt-3 text-[var(--color-muted-foreground)]">
          The app needs a Chromium-based browser to read and write a folder on
          your machine and to run a small embedding model locally.
        </p>
      </div>
      <ul className="space-y-2 text-sm text-[var(--color-foreground)]">
        {reasons.map((r) => (
          <li key={r} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5">·</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Try opening this page in Chrome, Edge, Brave, Opera, or Arc on a
        desktop computer.
      </p>
    </section>
  );
}

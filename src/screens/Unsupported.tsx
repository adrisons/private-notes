import type { UnsupportedKind } from "../lib/compatibility";

interface UnsupportedProps {
  reasons: string[];
  kind?: UnsupportedKind;
}

const COPY: Record<
  UnsupportedKind,
  { title: string; lead: string; hint: string }
> = {
  ios: {
    title: "iPhone and iPad aren’t supported yet.",
    lead: "The app needs to read and write a folder on your device, and no browser on iOS allows that. It runs on Android and on desktop instead.",
    hint: "Open this page in Chrome on Android, or in Chrome, Edge, Brave, Opera, or Arc on a computer.",
  },
  browser: {
    title: "This browser isn’t supported yet.",
    lead: "The app needs a Chromium-based browser to read and write a folder on your machine and to run a small embedding model locally.",
    hint: "Try opening this page in Chrome, Edge, Brave, Opera, or Arc — on desktop or on Android.",
  },
};

export function Unsupported({ reasons, kind = "browser" }: UnsupportedProps) {
  const copy = COPY[kind];
  return (
    <section className="mx-auto flex min-h-0 flex-1 max-w-xl flex-col items-start justify-center gap-6 px-6 py-16 sm:py-20">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm text-[var(--foreground-muted)]">{copy.lead}</p>
      </div>
      <ul className="space-y-2 text-sm text-[var(--foreground)]">
        {reasons.map((r) => (
          <li key={r} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5">·</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--foreground-muted)]">{copy.hint}</p>
    </section>
  );
}

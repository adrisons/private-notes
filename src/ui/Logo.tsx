export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <span className="font-mono text-sm tracking-tight">
        <span aria-hidden>▍</span> private-notes
      </span>
    </div>
  );
}

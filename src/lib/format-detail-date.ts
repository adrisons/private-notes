/** Absolute date + time for detail view timestamps. */
export function formatDetailDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

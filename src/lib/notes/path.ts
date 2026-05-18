import { slugify } from "./slug";
import { PATHS } from "../fs/types";

/** Build the storage path for a brand-new note: `notes/YYYY/MM/<slug>-<id>.md`. */
export function buildNotePath(
  title: string,
  id: string,
  createdAt: Date,
): string {
  const year = createdAt.getUTCFullYear().toString();
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const slug = slugify(title);
  return `${PATHS.notes}/${year}/${month}/${slug}-${id}.md`;
}

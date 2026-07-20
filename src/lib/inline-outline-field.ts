/** Resting border is transparent; hover and focus reveal the outline. */
export const inlineFieldBorderClass =
  "border border-transparent hover:border-[var(--border-strong)] " +
  "focus-visible:border-[var(--border-strong)] focus-within:border-[var(--border-strong)] " +
  "transition-[border-color] duration-[var(--duration-fast)] ease-[var(--ease-smooth)]";

/** Bordered inline field — SpaceTagsEditor shell without a fill or shadow. */
export const inlineOutlineFieldClass =
  "rounded-[var(--radius-md)] bg-transparent px-3 py-2 " +
  inlineFieldBorderClass;

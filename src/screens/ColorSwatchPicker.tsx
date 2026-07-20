import { cn } from "../lib/cn";
import { SPACE_COLOR_IDS, type SpaceColorId } from "../domain";

interface ColorSwatchPickerProps {
  value: SpaceColorId;
  onChange: (colorId: SpaceColorId) => void;
}

export function ColorSwatchPicker({ value, onChange }: ColorSwatchPickerProps) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Space color"
    >
      {SPACE_COLOR_IDS.map((colorId) => {
        const selected = colorId === value;
        return (
          <button
            key={colorId}
            type="button"
            aria-pressed={selected}
            aria-label={colorId}
            onClick={() => onChange(colorId)}
            className={cn(
              "u-focus h-8 w-8 cursor-pointer rounded-[var(--radius-sm)] border-2 transition-[transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-smooth)]",
              selected
                ? "scale-105 border-[var(--foreground)] shadow-[var(--shadow-rest)]"
                : "border-transparent hover:scale-105",
            )}
            style={{
              backgroundColor: `var(--chip-${colorId}-bg)`,
              color: `var(--chip-${colorId}-fg)`,
            }}
          />
        );
      })}
    </div>
  );
}

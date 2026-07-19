import { useEffect, useState } from "react";
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  subscribeSystemThemeChanges,
  type Theme,
} from "../lib/theme";
import { cn } from "../lib/cn";
import { Tooltip } from "./Tooltip";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
];

/** Line icons, 24px grid — never emoji (design.md §1.2). */
function ThemeIcon({ theme }: { theme: Theme }) {
  const shared = {
    "aria-hidden": true as const,
    className: "gesture-icon h-4 w-4",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (theme === "light") {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }

  if (theme === "system") {
    // Half-filled circle. An open arc reads as a second crescent at 16px,
    // which is exactly what "system" must not look like next to "dark".
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  // Crescent on a single radius: the previous path mixed two, which drew a
  // thin open arc rather than a moon.
  return (
    <svg {...shared}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
    </svg>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyTheme(stored, { animate: false });
    return subscribeSystemThemeChanges();
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="inline-flex items-center rounded-[var(--radius-full)] border border-[var(--border)] bg-[var(--surface-raised)] p-0.5 shadow-[var(--shadow-rest)]"
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <Tooltip key={opt.value} label={opt.label}>
          <button
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            onClick={() => {
              setTheme(opt.value);
              persistTheme(opt.value);
            }}
            className={cn(
              // Theme: the active icon rotates and grows (design.md §4.7).
              "gesture-theme u-press u-focus inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-full)]",
              "max-md:h-9 max-md:w-9",
              active
                ? "bg-[var(--accent-soft)] text-[var(--accent-soft-foreground)]"
                : "text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
            )}
          >
            <ThemeIcon theme={opt.value} />
          </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

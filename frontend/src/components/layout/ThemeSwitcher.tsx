import { useState } from "react";
import { getStoredTheme, setStoredTheme, THEME_OPTIONS, type Theme } from "../../theme/useTheme";

// cellar-muted is a CSS-variable hex color, so Tailwind's /opacity modifier
// can't apply to it directly, and browsers without color-mix (Safari < 16.2,
// Chrome < 111) would otherwise drop the border color declaration entirely.
// Using the plain color outright sidesteps both problems; full opacity vs.
// the originally intended 40% is a negligible visual difference here.
const OVERLAY_BORDER = "border-cellar-muted";

export function ThemeSwitcher({ variant = "default" }: { variant?: "default" | "overlay" }) {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  function handleChange(next: Theme) {
    setStoredTheme(next);
    setTheme(next);
  }

  const selectClass =
    variant === "overlay"
      ? `bg-black/30 border ${OVERLAY_BORDER} text-cellar-ink rounded px-2 py-1`
      : "bg-surface-raised border border-surface-border text-ink rounded px-2 py-1";

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Theme</span>
      <select value={theme} onChange={(e) => handleChange(e.target.value as Theme)} className={selectClass}>
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface text-ink">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

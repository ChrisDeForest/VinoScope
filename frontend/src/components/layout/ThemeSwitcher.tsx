import { useState } from "react";
import { getStoredTheme, setStoredTheme, THEME_OPTIONS, type Theme } from "../../theme/useTheme";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  function handleChange(next: Theme) {
    setStoredTheme(next);
    setTheme(next);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Theme</span>
      <select
        value={theme}
        onChange={(e) => handleChange(e.target.value as Theme)}
        className="bg-surface-raised border border-surface-border text-ink rounded px-2 py-1"
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

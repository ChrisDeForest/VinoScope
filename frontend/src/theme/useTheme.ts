export type Theme = "dark-burgundy" | "cream-terracotta" | "charcoal-gold";

const STORAGE_KEY = "vinoscope-theme";
const THEMES: Theme[] = ["dark-burgundy", "cream-terracotta", "charcoal-gold"];

export function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as string[]).includes(value);
}

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "dark-burgundy";
  } catch {
    return "dark-burgundy";
  }
}

export function setStoredTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable (private browsing, etc.) — theme still applies for this session
  }
}

export interface ThemeSwatch {
  surface: string;
  accent: string;
  ink: string;
  muted: string;
}

// `swatch` copies each theme's colors from themes.css so the picker can show every theme's
// colors at once (the CSS variables only ever hold the active theme). A test keeps them in sync.
export const THEME_OPTIONS: { value: Theme; label: string; swatch: ThemeSwatch }[] = [
  { value: "dark-burgundy", label: "Dark Burgundy", swatch: { surface: "#231416", accent: "#c9a86a", ink: "#e8dcc8", muted: "#a8908a" } },
  { value: "cream-terracotta", label: "Cream & Terracotta", swatch: { surface: "#f5efe6", accent: "#a8452f", ink: "#3a2a22", muted: "#7a6b5b" } },
  { value: "charcoal-gold", label: "Charcoal & Gold", swatch: { surface: "#1c1c1e", accent: "#d4af6a", ink: "#f0f0f0", muted: "#8a8a8e" } },
];

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

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark-burgundy", label: "Dark Burgundy" },
  { value: "cream-terracotta", label: "Cream & Terracotta" },
  { value: "charcoal-gold", label: "Charcoal & Gold" },
];

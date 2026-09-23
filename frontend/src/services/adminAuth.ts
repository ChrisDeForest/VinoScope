const STORAGE_KEY = "vinoscope_admin_key";

export function getAdminKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminKey(key: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, key);
  } catch {
    // sessionStorage unavailable (e.g. private browsing) - the admin session just won't persist.
  }
}

export function clearAdminKey(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

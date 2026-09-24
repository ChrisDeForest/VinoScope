export function readPageState<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writePageState<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage can be unavailable. */
  }
}

export function clearPageState(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Storage can be unavailable. */
  }
}

/**
 * localStorage that never throws. Private browsing, blocked site data or a
 * full quota make the native calls throw, which would otherwise break the
 * screen; here reads fall back to null and writes are skipped.
 */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
}

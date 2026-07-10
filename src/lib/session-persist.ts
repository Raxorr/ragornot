// Tiny SSR-safe sessionStorage helpers. Used to persist the LAST SUCCESSFUL
// Benchmark / Explore result so an accidental refresh doesn't wipe it (costly
// under the 3/day, 1-hour-apart limit). Only ephemeral result data is stored —
// never rate limits or cooldown, which stay server-authoritative and are always
// re-fetched. sessionStorage (not localStorage) means it survives a refresh but
// clears when the tab closes.

export const SESSION_KEYS = {
  benchmark: "ragornot:benchmark:lastResults",
  explore: "ragornot:explore:lastResult",
} as const;

export function loadSession<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveSession(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private-mode failures are non-fatal — persistence is best-effort.
  }
}

export function clearSession(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

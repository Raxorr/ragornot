"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./icons";

const STORAGE_KEY = "ragornot-theme";
type Theme = "light" | "dark";

// `data-theme` on <html> is the actual source of truth (set by the inline
// script in layout.tsx before first paint, then by `setTheme` below) — this
// component just mirrors it via useSyncExternalStore rather than duplicating
// it into React state, so there's no effect needed to keep the two in sync.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function setTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private browsing / storage disabled — theme just won't persist.
  }
  listeners.forEach((callback) => callback());
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-text transition-colors hover:border-accent hover:text-accent-text"
    >
      {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}

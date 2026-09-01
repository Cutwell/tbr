"use client";

import { useSyncExternalStore } from "react";

/**
 * Theme state.
 *
 * The source of truth is `data-theme` on the document element, which an inline
 * script in the head sets before first paint. Rather than mirroring that into
 * React state — which would mean reading the DOM in an effect and re-rendering
 * — the DOM *is* the store, and this subscribes to it.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "tbr.theme";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** The server has no document; light is the declared default. */
function getServerSnapshot(): Theme {
  return "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable — the choice simply won't survive a reload.
  }
  for (const listener of listeners) listener();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

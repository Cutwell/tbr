import { useSyncExternalStore } from "react";

/**
 * Transient notifications.
 *
 * Built on the same external-store pattern as the library, and for the same
 * reason: WebMCP tool handlers run outside React and need to raise UI. When an
 * agent adds a book, the toast that confirms it is pushed from the tool
 * handler — which is what makes agent activity legible on screen instead of
 * silently mutating a list.
 */

export interface Notification {
  id: string;
  message: string;
  /** Marks the toast as agent-initiated, which changes its treatment. */
  source?: "agent";
  action?: { label: string; run: () => void };
}

const DISMISS_AFTER_MS = 6_000;

const EMPTY: readonly Notification[] = Object.freeze([]);

let items: readonly Notification[] = EMPTY;
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(): void {
  for (const listener of listeners) listener();
}

function commit(next: readonly Notification[]): void {
  items = Object.freeze(next);
  emit();
}

export function notify(notification: Omit<Notification, "id">): string {
  const id = `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  commit([...items, { ...notification, id }]);

  timers.set(
    id,
    setTimeout(() => dismiss(id), DISMISS_AFTER_MS),
  );

  return id;
}

export function dismiss(id: string): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  commit(items.filter((item) => item.id !== id));
}

const notifications = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => items,
  getServerSnapshot: () => EMPTY,
};

export function useNotifications(): readonly Notification[] {
  return useSyncExternalStore(
    notifications.subscribe,
    notifications.getSnapshot,
    notifications.getServerSnapshot,
  );
}

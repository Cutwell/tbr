import { useSyncExternalStore } from "react";
import type { Shelf } from "@/lib/types";

/**
 * Where the app should be looking right now.
 *
 * WebMCP tool handlers run outside React — the browser's agent runtime calls
 * `execute()` directly — so a tool has no access to `useRouter()`. This module
 * holds the *intent* instead, the same way `confirmations.ts` holds a pending
 * confirmation: `NavigationController`, mounted once in `AppShell`, is the only
 * thing that turns a command into a real route change.
 *
 * `shelf` is `undefined` when the command has no opinion on the shelf filter
 * (leave whatever the reader had), and `null` to explicitly show every shelf —
 * so a plain boolean can't stand in for it.
 */

export interface NavigationCommand {
  id: number;
  path: string;
  shelf?: Shelf | null;
  /** Book ids to briefly pulse once the target view is showing. */
  highlightIds?: string[];
}

let current: NavigationCommand | null = null;
let counter = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function goTo(command: Omit<NavigationCommand, "id">): void {
  counter += 1;
  current = { id: counter, ...command };
  emit();
}

const navigation = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => current,
  getServerSnapshot: () => null,
};

export function usePendingNavigation(): NavigationCommand | null {
  return useSyncExternalStore(
    navigation.subscribe,
    navigation.getSnapshot,
    navigation.getServerSnapshot,
  );
}

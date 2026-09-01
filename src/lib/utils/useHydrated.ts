"use client";

import { useSyncExternalStore } from "react";

/** No-op subscription: the value never changes after the first client render. */
const noopSubscribe = () => () => {};

/**
 * True once the client has hydrated, false during server rendering.
 *
 * The `useSyncExternalStore` form is deliberate. The familiar
 * `useState(false)` + `useEffect(() => setMounted(true))` pattern does the same
 * job by triggering a second render from inside an effect, which React 19 flags
 * as a cascading render. This gets there in one pass with no effect at all.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { library } from "@/lib/store/store";
import type { Book } from "@/lib/types";

/**
 * Binds the library store to React.
 *
 * `useSyncExternalStore` is the right primitive here rather than context: the
 * store is mutated from outside React entirely — WebMCP tool handlers are
 * invoked by the browser's agent runtime, not by an event handler — and this
 * hook makes those writes re-render the tree with no bridging code.
 *
 * The server snapshot is an empty library, and hydration happens on mount, so
 * server and client markup agree on the first pass.
 */
export function useLibrary(): readonly Book[] {
  return useSyncExternalStore(
    library.subscribe,
    library.getSnapshot,
    library.getServerSnapshot,
  );
}

/**
 * Ids of books changed in the last few seconds, for the highlight treatment.
 *
 * The store owns the timing (see `markTouched`), so this is a plain read — no
 * clock in render, no state mirrored out of an effect.
 */
export function useRecentIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    library.subscribe,
    library.getTouched,
    library.getNoTouched,
  );
}

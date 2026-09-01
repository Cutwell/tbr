"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { library } from "@/lib/store/store";
import { usePendingNavigation } from "@/lib/store/navigation";

/**
 * Turns a pending navigation command into a real route change.
 *
 * Mounted once in `AppShell`, invisibly — it exists to hold the one
 * `useRouter()` a tool handler cannot reach for itself. See navigation.ts for
 * why the indirection is necessary.
 *
 * `router.push` to the route already showing is a same-URL no-op in the App
 * Router, so a rapid run of `add_book` calls (the "photo of a shelf" journey)
 * does not thrash navigation when the reader is already looking at the shelf.
 */
export function NavigationController() {
  const command = usePendingNavigation();
  const router = useRouter();
  const lastHandled = useRef(0);

  useEffect(() => {
    if (!command || command.id === lastHandled.current) return;
    lastHandled.current = command.id;

    router.push(command.path);
    if (command.highlightIds && command.highlightIds.length > 0) {
      library.touch(command.highlightIds);
    }
  }, [command, router]);

  return null;
}

import { useSyncExternalStore } from "react";

/**
 * A log of tool calls, for the on-screen agent activity panel.
 *
 * Not diagnostics — this is part of the product. An agent working through a
 * reading list otherwise looks like a page changing on its own; showing which
 * tool ran, with what result, is what makes the collaboration legible to the
 * person watching.
 */

export interface ToolCallRecord {
  id: string;
  tool: string;
  summary: string;
  at: number;
  failed: boolean;
}

const MAX_RECORDS = 8;

const EMPTY: readonly ToolCallRecord[] = Object.freeze([]);

let records: readonly ToolCallRecord[] = EMPTY;
const listeners = new Set<() => void>();

export function recordToolCall(tool: string, summary: string, failed = false): void {
  const record: ToolCallRecord = {
    id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    tool,
    summary,
    at: Date.now(),
    failed,
  };

  records = Object.freeze([record, ...records].slice(0, MAX_RECORDS));
  for (const listener of listeners) listener();
}

const activity = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => records,
  getServerSnapshot: () => EMPTY,
};

export function useToolActivity(): readonly ToolCallRecord[] {
  return useSyncExternalStore(
    activity.subscribe,
    activity.getSnapshot,
    activity.getServerSnapshot,
  );
}

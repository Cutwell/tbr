"use client";

import { useSyncExternalStore } from "react";
import {
  inspectHost,
  registerTools,
  type HostDiagnostics,
  type RegistrationMode,
} from "@/lib/webmcp/adapter";
import { auditToolDescriptors } from "@/lib/webmcp/format";
import { tools } from "@/lib/webmcp/tools";

/**
 * One-time tool registration, plus the status the UI reports.
 *
 * TBR registers all eight tools once at start-up and never re-registers. That
 * is a deliberate simplification: `registerTool` is additive while
 * `provideContext` replaces the whole set, so any state-dependent toolset would
 * have to be correct under both semantics. State-varying tools would buy
 * nothing here and cost a category of bug.
 */

export type WebMCPStatus =
  | { state: "pending" }
  | { state: "unsupported"; reason?: string; diagnostics?: HostDiagnostics }
  | {
      state: "ready";
      mode?: RegistrationMode;
      namespace?: string;
      toolCount: number;
      /**
       * The registered names, surfaced in the UI.
       *
       * ChatGPT's site tools are not programmatically enumerable by the model —
       * discovery is through its address-bar panel only — so asking an agent to
       * "list your tools" fails even when every tool is registered and working.
       * The page can answer that question itself, so it does.
       */
      toolNames: string[];
      /**
       * True when registration succeeded against `@mcp-b/webmcp-polyfill`
       * rather than a real host — tools are locally callable, but no external
       * agent is confirmed to be watching. The UI must not describe this the
       * same way as a genuine connection. See adapter.ts.
       */
      polyfilled: boolean;
    };

/** Frozen and shared: `useSyncExternalStore` loops if a snapshot getter
 *  returns a fresh object on every call. */
const PENDING: WebMCPStatus = Object.freeze({ state: "pending" });

let status: WebMCPStatus = PENDING;
let started = false;
const listeners = new Set<() => void>();

function setStatus(next: WebMCPStatus): void {
  status = next;
  for (const listener of listeners) listener();
}

export async function initialiseWebMCP(): Promise<void> {
  if (started) return;
  started = true;

  if (process.env.NODE_ENV !== "production") {
    // An over-long description throws nowhere — it just quietly degrades how
    // well an agent picks tools. Surface it in development instead.
    for (const violation of auditToolDescriptors(tools)) {
      console.warn(
        `[webmcp] ${violation.tool}.${violation.field} is ${violation.length} chars, ` +
          `over the ${violation.limit} budget`,
      );
    }
  }

  if (process.env.NODE_ENV !== "production") {
    /*
     * Development harness. Exposes the toolset so tools can be exercised from
     * the console without an agent, a Chrome flag, or the ChatGPT app:
     *
     *   await __tbrTools.get_taste_profile({})
     *
     * Stripped from production builds. Registration below is entirely
     * independent of this — it is a test seam, not a code path.
     */
    (window as unknown as Record<string, unknown>).__tbrTools = Object.fromEntries(
      tools.map((tool) => [
        tool.name,
        (args: Record<string, unknown> = {}) => tool.execute(args),
      ]),
    );
  }

  try {
    const result = await registerTools(tools);
    setStatus(
      result.supported
        ? {
            state: "ready",
            mode: result.mode,
            namespace: result.namespace,
            toolCount: result.toolCount,
            toolNames: tools.map((tool) => tool.name),
            polyfilled: result.polyfilled,
          }
        : {
            state: "unsupported",
            reason: "no modelContext on document, navigator or window",
            diagnostics: inspectHost(),
          },
    );
  } catch (error) {
    console.error("[webmcp] registration failed", error);
    setStatus({
      state: "unsupported",
      reason: error instanceof Error ? error.message : "registration threw",
      diagnostics: inspectHost(),
    });
  }
}

const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => status,
  getServerSnapshot: () => PENDING,
};

export function useWebMCPStatus(): WebMCPStatus {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

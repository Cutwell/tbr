import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";

/**
 * WebMCP host adapter.
 *
 * WebMCP is a live draft, and the shipping implementations disagree with the
 * proposal about where the API lives and how tools are registered:
 *
 *   ChatGPT site tools   document.modelContext.registerTool()    ← judged here
 *   Chrome imperative    document.modelContext.registerTool()
 *   W3C proposal         navigator.modelContext.provideContext()
 *
 * Registering against the wrong one produces an app with no tools and no error
 * message — a silent, total failure. So we detect at runtime and support both
 * namespaces and both registration styles. Every host-specific assumption in
 * the codebase lives in this file; if the spec moves again, this is the only
 * thing that changes.
 *
 * See docs/webmcp-reference.md.
 *
 * `initializeWebMCPPolyfill()` runs before every locate attempt. It is a
 * documented no-op whenever `document.modelContext` already exists — a real
 * host, ChatGPT's or Chrome's, is untouched — and outside a secure context, so
 * this can never shadow or downgrade a genuine implementation. What it *does*
 * change: a browser with no native WebMCP support at all now gets a working
 * `document.modelContext` anyway, so tools are locally registered and callable
 * by anything that knows to look for them there — this Claude session's own
 * browser tooling among them, confirmed by hand against another site's
 * polyfilled instance before adding this. It does not, and cannot, make an
 * unrelated agent like ChatGPT discover TBR from across a document boundary;
 * see the polyfill's own README ("the local polyfill cannot securely
 * implement cross-document discovery or exposure"). `registerTools()` reports
 * whether the host it found is this polyfill so callers can be honest about
 * the difference rather than claiming a confirmed agent that may not exist.
 */

/**
 * MCP tool annotations, with the spec's own defaults recorded.
 *
 * Every default here is pessimistic, and omitting an annotation is therefore
 * not a neutral absence of a claim — it is the loudest claim available. A
 * mutating tool that says nothing declares itself destructive, non-idempotent
 * and open-world, which is why every tool in this codebase states every hint
 * that applies to it. Quoted wording is from the MCP schema, 2025-06-18.
 */
export interface ToolAnnotations {
  /** "If true, the tool does not modify its environment." Default: false. */
  readOnlyHint?: boolean;
  /**
   * "If true, the tool may perform destructive updates to its environment.
   * If false, the tool performs only additive updates."
   *
   * Meaningful only when `readOnlyHint` is false. **Default: true** — so any
   * mutating tool that stays silent is declaring itself destructive. Note the
   * bar for `false` is *additive*, not "harmless" or "reversible": a tool that
   * replaces a field's value does not clear it.
   */
  destructiveHint?: boolean;
  /**
   * "If true, calling the tool repeatedly with the same arguments will have no
   * additional effect on the its environment."
   *
   * Meaningful only when `readOnlyHint` is false. Default: false.
   */
  idempotentHint?: boolean;
  /**
   * "If true, this tool may interact with an 'open world' of external
   * entities. If false, the tool's domain of interaction is closed."
   *
   * **Default: true.** In TBR only the two tools that call Open Library are
   * open-world; everything else touches nothing but the local store, and says
   * so rather than inheriting the opposite.
   */
  openWorldHint?: boolean;
  /**
   * Output is externally sourced and may carry injected instructions.
   *
   * Not an MCP annotation — a WebMCP addition, and the one hint here whose
   * absence is the safe direction.
   */
  untrustedContentHint?: boolean;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  /** Machine-readable mirror of `content`, for hosts that read it. */
  structuredContent?: unknown;
  isError?: boolean;
}

/**
 * The second argument to `execute`.
 *
 * Chrome's docs destructure it as `{ signal }`; the W3C proposal calls it
 * `agent` and hangs `requestUserInteraction` off it. Both are optional here
 * because neither is guaranteed to be present in a given host.
 */
export interface AgentHandle {
  requestUserInteraction?<T>(callback: () => Promise<T>): Promise<T>;
  signal?: AbortSignal;
}

export type ToolArgs = Record<string, unknown>;

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: ToolAnnotations;
  execute: (args: ToolArgs, agent?: AgentHandle) => Promise<ToolResponse> | ToolResponse;
}

interface RegisterOptions {
  exposedTo?: string[];
  signal?: AbortSignal;
}

/** The shape we hope to find on `document` or `navigator`. */
interface ModelContextHost {
  registerTool?: (tool: ToolDescriptor, options?: RegisterOptions) => Promise<void> | void;
  unregisterTool?: (name: string) => void;
  provideContext?: (context: { tools: ToolDescriptor[] }) => void;
}

export type RegistrationMode = "registerTool" | "provideContext";

export interface RegistrationResult {
  supported: boolean;
  mode?: RegistrationMode;
  namespace?: HostNamespace;
  toolCount: number;
  /**
   * True when the host that registered these tools is `@mcp-b/webmcp-polyfill`
   * rather than a real browser/agent implementation — i.e. tools exist and
   * are locally callable, but no external agent is confirmed to be watching.
   */
  polyfilled: boolean;
  /** Removes every tool this call registered. */
  unregister: () => void;
}

export type HostNamespace = "document" | "navigator" | "window";

/** Set by `@mcp-b/webmcp-polyfill` as a non-enumerable marker on the context
 *  it installs — absent on every real host. */
const POLYFILL_MARKER = "__isWebMCPPolyfill";

function isPolyfilled(host: ModelContextHost): boolean {
  return Boolean((host as Record<string, unknown>)[POLYFILL_MARKER]);
}

function probe(carrier: object | undefined): ModelContextHost | undefined {
  return (carrier as { modelContext?: ModelContextHost } | undefined)?.modelContext;
}

function locateHost(): { host: ModelContextHost; namespace: HostNamespace } | null {
  if (typeof window === "undefined") return null;

  // `document` first: it is what both shipping implementations document.
  // `window` is not in any spec — it costs one property read and removes a
  // hypothesis when a host turns out not to expose the API where we expect.
  const carriers: Array<[HostNamespace, object]> = [
    ["document", document],
    ["navigator", navigator],
    ["window", window],
  ];

  for (const [namespace, carrier] of carriers) {
    const host = probe(carrier);
    if (host) return { host, namespace };
  }

  return null;
}

export function supportsWebMCP(): boolean {
  return locateHost() !== null;
}

/**
 * What we could and could not see in this browser.
 *
 * Reported in the UI when registration fails. "No tools" has several very
 * different causes — a host that never exposes the API, an insecure context, a
 * disabled setting, a model with WebMCP switched off — and the reader deserves
 * to know which one they are looking at instead of a shrug.
 */
export interface HostDiagnostics {
  secureContext: boolean;
  found: HostNamespace | null;
  probed: HostNamespace[];
}

export function inspectHost(): HostDiagnostics {
  if (typeof window === "undefined") {
    return { secureContext: false, found: null, probed: [] };
  }

  return {
    secureContext: window.isSecureContext,
    found: locateHost()?.namespace ?? null,
    probed: ["document", "navigator", "window"],
  };
}

/**
 * Registers a toolset against whichever host is present.
 *
 * The two registration styles differ in more than spelling: `registerTool` is
 * additive and called once per tool, while `provideContext` *replaces* the
 * entire toolset on every call. Callers must not mix assumptions — which is
 * why TBR registers once at start-up and never re-registers.
 */
export async function registerTools(
  tools: ToolDescriptor[],
  options?: RegisterOptions,
): Promise<RegistrationResult> {
  // No-ops against a real host or an insecure context — see the module
  // comment above for why this is safe to call unconditionally.
  initializeWebMCPPolyfill();

  const located = locateHost();

  if (!located) {
    return { supported: false, toolCount: 0, polyfilled: false, unregister: () => {} };
  }

  const { host, namespace } = located;
  const polyfilled = isPolyfilled(host);

  if (typeof host.registerTool === "function") {
    for (const tool of tools) {
      await host.registerTool(tool, options);
    }
    return {
      supported: true,
      mode: "registerTool",
      namespace,
      toolCount: tools.length,
      polyfilled,
      unregister: () => {
        for (const tool of tools) host.unregisterTool?.(tool.name);
      },
    };
  }

  if (typeof host.provideContext === "function") {
    host.provideContext({ tools });
    return {
      supported: true,
      mode: "provideContext",
      namespace,
      toolCount: tools.length,
      polyfilled,
      // provideContext replaces wholesale, so an empty set is the removal.
      unregister: () => host.provideContext?.({ tools: [] }),
    };
  }

  return { supported: false, toolCount: 0, polyfilled: false, unregister: () => {} };
}

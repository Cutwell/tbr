# WebMCP Reference

Verified against primary sources on 29 August 2026. WebMCP is a moving target:
the specification changed shape between the August 2025 proposal and the
shipping implementations, so secondary sources are unreliable regardless of
publication date.

- Chrome: <https://developer.chrome.com/docs/ai/webmcp>
- ChatGPT site tools: <https://learn.chatgpt.com/docs/webmcp>
- W3C proposal: <https://webmachinelearning.github.io/webmcp/docs/proposal.html>

## The namespace divergence

The largest technical risk in the project. Three sources describe two API
surfaces.

| Source | Namespace | Method |
|---|---|---|
| ChatGPT site tools | `document.modelContext` | `registerTool()` |
| Chrome, imperative API | `document.modelContext` | `registerTool()` |
| W3C proposal, August 2025 | `navigator.modelContext` | `provideContext({tools})` |

Registering against the wrong namespace produces an app with no tools and no
error message. Both shipping implementations document
`document.modelContext.registerTool()`, but the cost of being wrong is total
failure of the agent features.

**Decision: a registration adapter** that feature-detects and registers against
whatever the host exposes, covering both namespaces and both methods. It is a
small amount of code and it eliminates the entire failure class. The
implementation is [`src/lib/webmcp/adapter.ts`](../src/lib/webmcp/adapter.ts).

```js
const host = document.modelContext ?? navigator.modelContext ?? null;

if (typeof host.registerTool === "function") {
  for (const t of tools) await host.registerTool(t);  // additive, per tool
} else if (typeof host.provideContext === "function") {
  host.provideContext({ tools });                     // replaces the whole set
}
```

The two methods differ semantically. `registerTool` is additive;
`provideContext` replaces the entire toolset on each call. Any code that
re-registers on state change must be correct under both, which is part of the
rationale for registering once and never re-registering
([tool-design.md](tool-design.md)).

The adapter also initialises
[`@mcp-b/webmcp-polyfill`](https://www.npmjs.com/package/@mcp-b/webmcp-polyfill)
when no native host is present, making tools locally callable in an ordinary
browser. The polyfill cannot make an unrelated agent discover the page across a
document boundary, a limitation its own documentation states explicitly.
Registration therefore reports whether the host it found was the polyfill, and
the UI distinguishes "registered" from "connected" accordingly.

## Tool descriptor shape

```js
await document.modelContext.registerTool({
  name: "search_my_books",
  description: "Search the reader's own shelves. Filter by status or rating.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["tbr", "read", "dnf"],
                description: "Shelf to search. Omit for all shelves." },
      query:  { type: "string", description: "Title or author substring." },
    },
    required: [],
    additionalProperties: false,   // present in ChatGPT's documented examples
  },
  annotations: { readOnlyHint: true },
  execute: async (args, agent) => { /* … */ },
}, {
  exposedTo: ["https://chatgpt.com"],  // optional origin allowlist
  signal: controller.signal,           // abort unregisters the tool
});
```

### Return value

The proposal specifies MCP-style content blocks. ChatGPT's published example
returns a bare object. The content-block form is the safer choice: it matches
the specification, and hosts that accept plain objects generally accept it as
well. A single helper keeps the decision in one place.

```js
const ok  = (text, data) => ({ content: [{ type: "text", text }], structuredContent: data });
const err = (text)       => ({ content: [{ type: "text", text }], isError: true });
```

### Human-in-the-loop

`agent.requestUserInteraction()` allows a tool to block on user consent during
execution. `remove_book` uses it to keep the reader in control of deletion.

The signature is documented inconsistently: Chrome destructures the second
parameter as `{ signal }`, while the proposal names it `agent`. Treating it as
an opaque object and reading both properties defensively covers both.

## Hard limits

Chrome describes the following as recommendations that "may become formal API
requirements". They are treated here as hard limits.

| Constraint | Budget |
|---|---|
| Tool name | 30 characters |
| Tool description | 500 characters |
| Parameter description | 150 characters |
| Tool output | 1,500 characters |

The output cap is the defining constraint of the project. Raw Open Library
records include large arrays and fields that these journeys do not use. Field
projection and result caps are therefore correctness requirements rather than
optimisations. See [tool-design.md](tool-design.md).

## Security annotations

| Annotation | Meaning | Applied to |
|---|---|---|
| `readOnlyHint` | Does not mutate state; the agent may call it freely | All search, profile and navigation tools |
| `destructiveHint` | May replace or remove existing data | `update_book`, `remove_book`; `false` on additive `add_book` |
| `idempotentHint` | Repeating a call has no additional effect | All three mutating tools |
| `openWorldHint` | May interact with external systems | `search_catalog`, `add_book`; `false` on the other five tools |
| `untrustedContentHint` | Payload is externally sourced and may carry injected instructions | `search_catalog` |
| `exposedTo` | Restricts cross-origin discovery | Unused; TBR requires no cross-origin exposure |

`untrustedContentHint` on `search_catalog` reflects a real property of the data
rather than a formality. Open Library records are editable by anyone, so a title
field is attacker-controlled input that reaches the agent's context verbatim.

## Platform constraints

From ChatGPT's site-tools documentation:

- Declarative HTML form annotations are unsupported. Chrome documents them;
  ChatGPT does not implement them. Only the imperative API is portable.
- Tools inside iframes are not discovered. Registration must occur in
  top-level page JavaScript.

TBR registers from the app shell, which is top-level on every route.

## Testing surfaces

| Surface | Procedure |
|---|---|
| Extension | [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) invokes tools without an agent. The fastest development loop. |
| Chrome | Set `chrome://flags/#enable-webmcp-testing` to Enabled and relaunch, or use the origin trial available from Chrome 149. |
| ChatGPT desktop | Open the URL in the in-app browser, then **Site tools** in the address bar, which lists available tools and recent calls. |

## Compatibility strategy

All seven tools use the same adapter and MCP content-block response shape. The
adapter covers both documented namespaces and registration methods; the app
reports whether it found a native host, the development polyfill, or no host.

`remove_book` does not depend on native `requestUserInteraction` support. It
uses the host method when available and falls back to the application's own
confirmation dialog when the method is absent or rejects. Both paths await an
explicit reader decision before deletion. Reproducible repository checks are
listed in [verification.md](verification.md).

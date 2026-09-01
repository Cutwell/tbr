# 02 — WebMCP Reference

Verified against primary sources on 29 August 2026. WebMCP is a moving target —
the spec changed shape between the August 2025 proposal and the shipping
implementations — so **do not trust blog posts**, including recent ones.

- Chrome: <https://developer.chrome.com/docs/ai/webmcp>
- ChatGPT site tools: <https://learn.chatgpt.com/docs/webmcp>
- W3C proposal: <https://webmachinelearning.github.io/webmcp/docs/proposal.html>

## The namespace divergence

The single biggest technical risk in the project. Three sources, two API
surfaces:

| Source | Namespace | Method |
|---|---|---|
| **ChatGPT site tools** — our judging surface | `document.modelContext` | `registerTool()` |
| **Chrome** — imperative API | `document.modelContext` | `registerTool()` |
| **W3C proposal** — Aug 2025 | `navigator.modelContext` | `provideContext({tools})` |

Registering against the wrong one produces an app with no tools and no error
message. Both shipping implementations document
`document.modelContext.registerTool()`, but being wrong is not survivable.

**Decision: a registration adapter** that feature-detects and registers against
whatever the host exposes, both namespaces and both methods. It is a small
amount of code and it removes the entire "judge opens it and sees nothing"
failure class. Shipped as
[`src/lib/webmcp/adapter.ts`](../src/lib/webmcp/adapter.ts):

```js
const host = document.modelContext ?? navigator.modelContext ?? null;

if (typeof host.registerTool === "function") {
  for (const t of tools) await host.registerTool(t);  // additive, per tool
} else if (typeof host.provideContext === "function") {
  host.provideContext({ tools });                     // replaces the whole set
}
```

Note the semantic difference the adapter papers over: `registerTool` is
**additive**, `provideContext` **replaces the entire toolset**. Any code that
re-registers on state change has to be correct under both, which is a large part
of why TBR registers once and never re-registers ([04](04-tool-design.md)).

The adapter also initialises [`@mcp-b/webmcp-polyfill`](https://www.npmjs.com/package/@mcp-b/webmcp-polyfill)
when no native host is present, so tools are locally callable in a plain
browser. It cannot make an unrelated agent discover the page across a document
boundary — the polyfill's own README is explicit about that — so registration
reports whether the host it found was the polyfill, and the UI says
"registered" rather than "connected" in that case. Claiming a connection that
does not exist is worse than admitting there isn't one.

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
    additionalProperties: false,   // ChatGPT's docs show this; include it
  },
  annotations: { readOnlyHint: true },
  execute: async (args, agent) => { /* … */ },
}, {
  exposedTo: ["https://chatgpt.com"],  // optional origin allowlist
  signal: controller.signal,           // abort ⇒ unregisters the tool
});
```

**Return value.** The proposal specifies MCP-style content blocks; ChatGPT's own
example returns a bare object. Returning the content-block form is the safer
bet — it is the spec shape, and hosts that accept plain objects generally accept
it too. One helper, one place to change it:

```js
const ok  = (text, data) => ({ content: [{ type: "text", text }], structuredContent: data });
const err = (text)       => ({ content: [{ type: "text", text }], isError: true });
```

**Human-in-the-loop.** `agent.requestUserInteraction()` lets a tool block on real
consent mid-execution. It is the highest-signal feature available for the
"humans and agents working together" criterion, and `remove_book` uses it.

Signature caution: Chrome's docs destructure the second parameter as
`{ signal }`; the proposal calls it `agent`. Treat it as an opaque object and
read both properties off it defensively.

## Hard limits

Chrome describes these as recommendations that "may become formal API
requirements". Treat them as hard limits.

| Thing | Budget |
|---|---|
| Tool name | 30 characters |
| Tool description | 500 characters |
| Parameter description | 150 characters |
| **Tool output** | **1,500 characters** |

**The 1,500-character output cap is the defining constraint of this project.**
For calibration: a raw Open Library search response for *two* books is 2,838
bytes, mostly a 100-element ISBN array. Naive pass-through blows the budget on
the first call. Field projection and result caps are correctness, not
optimisation — see [04](04-tool-design.md).

## Security annotations

| Annotation | Meaning | Used on |
|---|---|---|
| `readOnlyHint` | Does not mutate; the agent may call freely | Every search, profile and navigation tool |
| `destructiveHint` | Destroys data | `remove_book` |
| `untrustedContentHint` | Payload is externally sourced and may carry injected instructions | `search_catalog` |
| `exposedTo` | Restrict which origins may call | Not used; the default is right for a public demo |

`untrustedContentHint` on `search_catalog` is a real call, not box-ticking.
Anyone can edit an Open Library record, so a title field is attacker-controlled
input that lands verbatim in the agent's context.

## Platform constraints

From ChatGPT's site-tools docs:

- **No declarative HTML form annotations.** Chrome documents them; ChatGPT does
  not support them. Use the imperative API only.
- **Tools inside iframes are not discovered.** Register from the top-level page.

TBR registers from the app shell, which is top-level on every route.

## Testing

| Surface | How |
|---|---|
| Extension | [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) — invoke tools with no agent at all. Fastest loop; use it first. |
| Chrome | `chrome://flags/#enable-webmcp-testing` → Enabled → relaunch. Chrome 146+ ships `modelContext`; origin trial from 149. |
| ChatGPT desktop | Open the URL in the in-app browser, then **Site tools** in the address bar — lists available tools and recent calls. |

## What remains unconfirmed

The first seven tools were exercised live in ChatGPT's in-app browser:
registered, listed under **Site tools**, callable, returning output the agent
acted on. That closes the namespace risk (R1 in [07](07-risks.md)) against the
real judging surface.

`navigate_to` was added after that pass and has only been exercised through the
dev harness and the Inspector. It registers through the same adapter and carries
no host-specific behaviour, so the risk is low — but it should be confirmed on
the live URL alongside the rehearsal ([06](06-roadmap.md)).

Three lower-level questions were *not* individually instrumented during that
pass, and the honest reason is that the code is defensive enough that both
branches look identical from outside:

1. **Return shape** — whether ChatGPT requires `{content:[…]}` or accepts a bare
   object. `format.ts` always emits the content-block form, so the two were
   never distinguished.
2. **`requestUserInteraction`** — whether it fired natively or whether
   `remove_book` fell back to the app's own dialog.
   `agent?.requestUserInteraction?.()` makes both paths behave the same.
3. **Overrun behaviour** — never observed, because no tool exceeded the budget
   in testing. The largest measured output was 732 characters.

Question 2 is the one that matters: the demo's human-in-the-loop beat should
describe the path that actually runs. A console log in each branch settles it in
a minute.

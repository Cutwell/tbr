# 02 — WebMCP Reference (verified 2026-08-29)

Everything here was checked against primary sources on the date above. WebMCP is
a moving target: the spec changed shape between the August 2025 proposal and the
shipping implementations, so **do not trust blog posts** — including recent ones.

Sources:
- Chrome: <https://developer.chrome.com/docs/ai/webmcp>
- ChatGPT site tools: <https://learn.chatgpt.com/docs/webmcp>
- W3C proposal: <https://webmachinelearning.github.io/webmcp/docs/proposal.html>

## ⚠️ The namespace divergence — read this first

The single biggest technical risk in this project. Three sources, two different
API surfaces:

| Source | Namespace | Primary method |
|---|---|---|
| **ChatGPT site tools** (our judging surface) | `document.modelContext` | `registerTool()` |
| **Chrome docs** (imperative API) | `document.modelContext` | `registerTool()` |
| **W3C proposal** (Aug 2025) | `navigator.modelContext` | `provideContext({tools:[…]})` |
| Netlify's challenge post | `navigator.modelContext` | `registerTool()` |

`document.modelContext.registerTool()` is what both shipping implementations
document, and ChatGPT's browser is where judges will look. But we cannot afford
to be wrong.

**Decision: ship a registration adapter** that feature-detects and registers
against whatever the host exposes, supporting both namespaces and both methods.
This is ~40 lines and removes the entire class of "judge opens it and sees no
tools" failure. Sketch:

```js
// src/webmcp/adapter.js
function host() {
  return (typeof document !== 'undefined' && document.modelContext)
      || (typeof navigator !== 'undefined' && navigator.modelContext)
      || null;
}

export function supportsWebMCP() { return host() !== null; }

export async function registerTools(tools) {
  const mc = host();
  if (!mc) return false;

  if (typeof mc.registerTool === 'function') {
    for (const t of tools) await mc.registerTool(t);   // per-tool, additive
    return true;
  }
  if (typeof mc.provideContext === 'function') {
    mc.provideContext({ tools });                       // bulk, replaces set
    return true;
  }
  return false;
}
```

Note the semantic difference the adapter papers over: `registerTool` is
**additive** (one call per tool), `provideContext` **replaces the entire
toolset** on every call. Any code that re-registers on state change must be
written for the replace-everything semantics or it will duplicate tools.

## Tool descriptor shape

```js
await document.modelContext.registerTool({
  name: 'search_my_books',
  description: 'Search the reader\'s own shelves. Filter by status or rating.',
  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['tbr','read','dnf'],
                description: 'Shelf to search. Omit for all shelves.' },
      query:  { type: 'string', description: 'Title or author substring.' }
    },
    required: [],
    additionalProperties: false     // ChatGPT docs show this; include it
  },
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: false
  },
  execute: async (args, { signal } = {}) => { /* … */ }
}, {
  exposedTo: ['https://chatgpt.com'],   // optional origin allowlist
  signal: abortController.signal        // abort ⇒ unregisters the tool
});
```

### Return value

The W3C proposal specifies MCP-style content blocks:

```js
return { content: [{ type: 'text', text: 'Added The Dispossessed to your TBR.' }] };
```

ChatGPT's own example returns a **bare object** (`{ title: document.title }`).
To be safe, return the content-block form — it is the spec shape and hosts that
accept plain objects will generally accept it. Standardise this in one helper so
it can be swapped in a single place if testing shows otherwise:

```js
const ok  = (text, data) => ({ content: [{ type: 'text', text }], structuredContent: data });
const err = (text)       => ({ content: [{ type: 'text', text }], isError: true });
```

### Human-in-the-loop

`agent.requestUserInteraction()` lets a tool block on real user consent
mid-execution. This is the highest-signal feature for the "humans and agents
working together" judging criterion, and we use it on destructive calls:

```js
execute: async ({ book_id }, agent) => {
  const confirmed = await agent.requestUserInteraction(async () =>
    confirm(`Remove "${titleOf(book_id)}" from your list?`));
  if (!confirmed) return err('User declined. Book was not removed.');
  // …
}
```

Signature caution: Chrome docs show the second parameter destructured as
`{ signal }`, the proposal calls it `agent`. Treat the second arg as an opaque
object and read both properties off it defensively.

## Hard limits (from Chrome's security guidance)

These are described as recommendations that "may become formal API
requirements". Treat them as hard limits.

| Thing | Budget |
|---|---|
| Tool name | 30 characters |
| Tool description | 500 characters |
| Parameter description | 150 characters |
| **Tool output** | **1,500 characters** |

**The 1.5K output cap is the defining constraint of this project.** For
calibration: a raw Open Library search response for *two* books is 2,838 bytes,
mostly a 100-element ISBN array. Naive pass-through of catalog or shelf data
blows the budget on the first call. Field projection and result caps are not
optimisations here, they are correctness. See [04](04-tool-design.md).

## Security annotations

| Annotation | Meaning | Where we use it |
|---|---|---|
| `readOnlyHint: true` | Tool does not mutate state; agent can call freely without confirming | All search/profile tools |
| `untrustedContentHint: true` | Returned payload is externally sourced and may carry injected instructions | **`search_catalog`** — Open Library is a public wiki, records are attacker-editable |
| `exposedTo: [origins]` | Restrict which origins may call the tool | Consider for write tools |

The `untrustedContentHint` on `search_catalog` is a genuine, defensible security
call rather than box-ticking: Open Library lets anyone edit a book record, so a
title field is untrusted input that ends up in an agent's context. Worth calling
out explicitly in the submission text — it demonstrates the depth judges are
scoring for.

## Platform constraints

From ChatGPT's site-tools docs:

- **No declarative HTML form annotations.** Chrome documents a declarative API;
  ChatGPT does not support it. **Use the imperative API only.**
- **Tools inside iframes are not discovered.** Register from the top-level page.
- Registration must happen in top-level page JavaScript.

Implication for our stack: no iframe-based embeds, and registration runs from
the app shell, not a widget.

## Testing

| Surface | How |
|---|---|
| Chrome | `chrome://flags/#enable-webmcp-testing` → Enabled → relaunch. Chrome 146+ ships `modelContext`; origin trial from 149. |
| ChatGPT desktop app | Open the URL in the in-app browser, then **"Site tools"** in the address bar → "Available site tools" lists tools, "Recently used" shows call history. |
| Extension | [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) — inspect and invoke tools without an agent. Fastest dev loop; use this first. |

Reference demos to crib patterns from:
<https://github.com/GoogleChromeLabs/webmcp-tools/tree/main/demos> (Pizza Maker,
Travel Booking, Le Petit Bistro) and OpenAI's forkable examples (Kurio, Mabel's
Table, The Archive).

## Open questions — status after Day 1

All seven tools were exercised live in ChatGPT's in-app browser and worked
end-to-end: registered, discoverable in **Site tools**, callable, and
returning output the agent could act on. That confirms the adapter's
namespace detection and the overall registration path against the real
judging surface — the biggest risk on this page (R1 in
[07-risks.md](07-risks.md)) is resolved.

The three specific protocol questions below were **not individually
instrumented** during that pass — nothing logged which code path actually
ran — so treat them as unconfirmed rather than answered. The code was written
defensively enough (see each item) that the app worked regardless of which
branch fired, which is exactly why it wasn't obvious from the outside which
one did:

1. **Return shape.** Still unknown whether ChatGPT requires the
   `{content:[…]}` form or accepts a bare object — `format.ts`'s `ok()`/`err()`
   always emit the content-block form, so this was never distinguished.
2. **`requestUserInteraction`.** Still unknown whether it fired natively in
   ChatGPT's browser or whether `remove_book` ran its direct-dialog fallback
   instead — `agent?.requestUserInteraction?.()` makes both paths look
   identical from outside. Worth a targeted check (e.g. a console log in each
   branch) before relying on this for the demo video's human-in-the-loop beat.
3. **Overrun behaviour.** Never observed, because no tool exceeded the 1.5K
   budget in testing (606 chars was the largest measured output) — the
   truncate-vs-error question simply didn't come up.

If the video script depends on any of these specifics (Q2 especially — see
[08-submission.md](08-submission.md)'s human-in-the-loop beat), confirm it
directly rather than assuming.

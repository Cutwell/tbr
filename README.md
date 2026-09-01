# TBR — a reading list your agent can read too

A reading list that tracks what you want to read, what you finished, and what
you gave up on — and exposes all of it to AI agents as
[WebMCP](https://developer.chrome.com/docs/ai/webmcp) tools.

Built for the [WebMCP Challenge](https://webmcp.devpost.com).

> **Live demo:** <https://tbr-navy.vercel.app> · **Video:** _(pending)_

---

## Why WebMCP

Reading lists are where books go to die. "What should I read next?" is a
question about *taste*, and answering it means holding sixty books, their
ratings, and the ones you abandoned in your head at once.

A general browser agent could scrape the page, but WebMCP tool output is capped
at **1,500 characters**. Eighty books with ratings do not fit, and paging
through them burns the agent's context on data it should never have had to
parse.

So TBR does the work instead. **`get_taste_profile`** aggregates the whole
reading history *on the site* — favourite authors by mean rating, abandoned
authors, era distribution, finishing rate — and returns it in about 700
characters with a computed signal line:

```
Signal: Has given up on Neal Stephenson more than once.
```

The agent gets a hypothesis to reason from, not a data dump to wade through.
That is the argument for WebMCP in one line: the site knows its own data and can
pre-compute exactly the summary an agent needs.

## The tools

Eight, registered on the top-level page. Full rationale in
[docs/04-tool-design.md](docs/04-tool-design.md); the implementation is
[src/lib/webmcp/tools.ts](src/lib/webmcp/tools.ts).

| Tool | Mutates | Annotations |
|---|---|---|
| `search_catalog` | no | `readOnlyHint`, `untrustedContentHint` |
| `search_my_books` | no | `readOnlyHint` |
| `get_taste_profile` | no | `readOnlyHint` |
| `add_book` | yes | — |
| `update_book` | yes | — |
| `remove_book` | **destructive** | `destructiveHint` + `requestUserInteraction` |
| `import_books` | yes | — |
| `navigate_to` | view only | `readOnlyHint` |

Four details worth calling out:

- **`untrustedContentHint` on `search_catalog` is a real mitigation.** Open
  Library is a public wiki — anyone can edit a book record, and that text lands
  verbatim in the agent's context. It is an indirect prompt-injection surface.
- **`remove_book` blocks on a human.** It calls `requestUserInteraction()` and
  awaits an actual decision. Declining is reported back to the agent honestly
  rather than swallowed, and the same dialog serves the app's own delete button
  — there is exactly one path to destroying a book.
- **`navigate_to` keeps the screen with the conversation.** Most tools end their
  output by handing off to it, so a recommendation leaves the reader looking at
  the book rather than merely hearing its name.
- **Every error names the next tool to call**, per Chrome's guidance that a
  failed call should "act as a guide rather than a dead end".

## Running locally

```bash
npm install && npm run dev
```

To check production behaviour, build the static export and serve it — `next
start` does not apply to an exported app:

```bash
npm run build && npx serve out
```

Agent features need a WebMCP-capable browser:

**Chrome** — visit `chrome://flags/#enable-webmcp-testing`, set it to Enabled,
relaunch, then open the app. The
[Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd)
extension lets you invoke tools directly.

**ChatGPT desktop app** — open the URL in the in-app browser, then choose
**Site tools** in the address bar to see the registered tools and call history.

In any other browser the app is fully usable by hand and says plainly that agent
features are unavailable.

In development the toolset is also on `window.__tbrTools`, so you can exercise
it from the console with no agent at all:

```js
await __tbrTools.get_taste_profile({})
await __tbrTools.search_my_books({ status: "tbr", limit: 5 })
```

### Resetting the demo library

The library lives in `localStorage`, seeded with 80 books on first visit. There
is deliberately no reset button — a control that wipes your reading list is not
something a reading list should offer. To get back to the seeded state, clear
the key and reload:

```js
localStorage.removeItem("tbr.library.v1"); location.reload();
```

Any empty or corrupt value reseeds automatically, so that is the whole
procedure. The Open Library cache clears the same way:

```js
Object.keys(localStorage).filter(k => k.startsWith("tbr.cache")).forEach(k => localStorage.removeItem(k));
```

## How it is built

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4. **No backend** —
Open Library is called client-side and the library lives in `localStorage`, so
judges open a URL and use it immediately with no login wall.

### The one architectural rule

> **WebMCP tools never touch `localStorage` or React state directly. They call
> the same store the UI calls.**

If a tool wrote around [the store](src/lib/store/store.ts), an agent's changes
would not appear until reload — and the entire visual payoff is watching books
land on the shelf as the agent works. The store is an external store consumed
through `useSyncExternalStore`, so writes from outside React re-render the tree
with no bridging code.

### Components: atoms → molecules → organisms

```
src/app/
  layout.tsx        fonts, theme bootstrap, metadata
  page.tsx          the shelf
  search/           catalogue search, add, Goodreads import
  taste/            the reading profile
  book/             one book — synopsis, subjects, shelf and rating.
                    `?id=` is a shelf id *or* an Open Library work key, so a
                    search result and a shelf card lead to the same page

src/components/
  atoms/       Button  Chip  Icon  IconButton  ShelfDot  Spinner  Star  TextInput
  molecules/   BookCover  EmptyState  FilterBar  NavLink  SearchField
               ShelfBadge  StarRating  StatFigure  ThemeToggle
  organisms/   AgentIndicator  BookCard  BookGrid  ConfirmDialog  ImportPanel
               NavigationController  SiteHeader  TasteProfile  ToastStack
  templates/   AppShell        ← header, page slot, global surfaces

src/lib/
  store/       store  profile  seed  notifications  confirmations  useLibrary
  catalog/     openlibrary  cache                   ← Open Library client
  webmcp/      adapter  tools  format  input  register  activity
```

Pages hold the data; components hold none of it. `AppShell` runs start-up once
for the whole session, so a reader landing on a book page gets the same
hydrated library and registered tools as one landing on the shelf.

### Humans first

TBR is a reading list that also speaks WebMCP, not a WebMCP demo with books in
it. Agent status is a dot in the header corner that opens a popover on click —
tool activity stays legible through toasts and a pulse on any changed book,
without a panel competing with the covers.

### The adapter, and why it exists

WebMCP is a live draft and the implementations disagree about where the API
lives:

| | Namespace | Method |
|---|---|---|
| ChatGPT site tools | `document.modelContext` | `registerTool()` |
| Chrome imperative | `document.modelContext` | `registerTool()` |
| W3C proposal | `navigator.modelContext` | `provideContext()` |

Registering against the wrong one yields an app with no tools and no error
message. [`adapter.ts`](src/lib/webmcp/adapter.ts) detects at runtime and
supports both namespaces and both registration styles. Every host-specific
assumption in the codebase lives in that one file.

### Performance

Open Library sends no cache headers on `search.json`, so every reload refetched
everything. [`cache.ts`](src/lib/catalog/cache.ts) is a bounded, TTL'd
`localStorage` cache in front of it, and a warm reload of a search or book page
now makes **zero** network requests. It fails soft in every direction — a cache
that throws is worse than no cache, and the library must never lose its storage
slot to one.

### Design

Warm editorial — paper-bone grounds, warm ink, a single persimmon accent.
`Fraunces` for display (variable, soft and slightly wonky), `Karla` for UI, and
`DM Mono` reserved strictly for shelf metadata as a nod to library card
catalogues. Tokens are semantic (`paper`, `ink`) and swap wholesale for dark
mode, so no component carries a `dark:` variant.

## Deploying

The app is a **static export** (`output: "export"` in `next.config.ts`). No
backend, no API route, no server data — so `npm run build` emits `out/` (~1.4MB)
and that directory is the whole site.

That makes it portable to any of the hackathon's accepted hosts. **Deployed on
Vercel**, where `vercel --prod` pushes `out/` directly with no server config.
ChatGPT Sites was considered and dropped — regional availability and
access-default risk were not worth carrying against the deadline — and `out/`
would deploy just as easily to Netlify, Cloudflare Pages or Render.

Whatever the host, WebMCP needs a **secure context**, so the site must be served
over HTTPS with no login wall in front of it. The full reasoning is in
[docs/05-architecture.md](docs/05-architecture.md#decision-vercel-not-chatgpt-sites).

## Docs

The plan this was built from lives in [docs/](docs/README.md) — the hackathon
brief, a verified WebMCP API reference, tool design with the output-budget
maths, architecture, the risk register, and the roadmap.

## Licence

[MIT](LICENSE).

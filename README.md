# TBR — a reading list your agent can read too

A reading list that tracks what you want to read, what you finished, and what
you gave up on, and exposes all of it to AI agents as
[WebMCP](https://developer.chrome.com/docs/ai/webmcp) tools.

Built for the [WebMCP Challenge](https://webmcp.devpost.com).

> **Live demo:** <https://tbr-navy.vercel.app> · **Video:** _(pending)_

---

## Why WebMCP

Reading lists accumulate faster than they are read, and "what should I read
next?" is a question about taste. Answering it means weighing sixty books, their
ratings, and the ones that were abandoned, all at once.

A general browser agent could scrape the page, but WebMCP tool output is capped
at 1,500 characters. Eighty books with ratings do not fit, and paging through
them spends the agent's context on data it should never have had to parse.

TBR performs the aggregation instead. `get_taste_profile` reduces the whole
reading history on the site (favourite authors by mean rating, abandoned
authors, era distribution, finishing rate) to roughly 700 characters, closing
with a computed signal line:

```
Signal: Has given up on Neal Stephenson more than once.
```

The agent receives a hypothesis to reason from rather than a dataset to
interpret. That is the argument for WebMCP in one line: the site holds its own
data and can pre-compute the exact summary an agent needs.

## The tools

Eight, registered on the top-level page. The rationale is in
[docs/04-tool-design.md](docs/04-tool-design.md); the implementation is
[src/lib/webmcp/tools.ts](src/lib/webmcp/tools.ts).

| Tool | Mutates | Annotations |
|---|---|---|
| `search_catalog` | no | `readOnlyHint`, `untrustedContentHint` |
| `search_my_books` | no | `readOnlyHint` |
| `get_taste_profile` | no | `readOnlyHint` |
| `add_book` | yes | — |
| `update_book` | yes | — |
| `remove_book` | destructive | `destructiveHint` + `requestUserInteraction` |
| `import_books` | yes | — |
| `navigate_to` | view only | `readOnlyHint` |

Four properties of the set are worth stating explicitly.

- **`untrustedContentHint` on `search_catalog` reflects a real property of the
  data.** Open Library is a public wiki: any record is editable by anyone, and
  that text reaches the agent's context verbatim. The tool is an indirect
  prompt-injection surface.
- **`remove_book` blocks on a human decision.** It calls
  `requestUserInteraction()` and awaits the outcome. A refusal is reported back
  to the agent rather than swallowed, and the same dialog serves the
  application's own delete control, leaving one path to destroying a book.
- **`navigate_to` keeps the screen aligned with the conversation.** Most tools
  close their output by handing off to it, so a recommendation leaves the reader
  viewing the book rather than only hearing its name.
- **Every error names the next tool to call**, following Chrome's guidance that a
  failed call should act as a guide rather than a dead end.

## Running locally

```bash
npm install && npm run dev
```

Production behaviour requires the static export, since `next start` does not
apply to an exported application:

```bash
npm run build && npx serve out
```

Agent features require a WebMCP-capable browser.

**Chrome.** Set `chrome://flags/#enable-webmcp-testing` to Enabled, relaunch,
then open the application. The
[Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd)
extension invokes tools directly.

**ChatGPT desktop app.** Open the URL in the in-app browser, then select **Site
tools** in the address bar to see registered tools and call history.

In any other browser the application remains fully usable by hand and reports
that agent features are unavailable.

In development the toolset is also exposed on `window.__tbrTools`, which allows
it to be exercised from the console without an agent:

```js
await __tbrTools.get_taste_profile({})
await __tbrTools.search_my_books({ status: "tbr", limit: 5 })
```

### Resetting the demo library

The library lives in `localStorage` and is seeded with 80 books on first visit.
There is deliberately no reset control, since a control that erases a reading
list does not belong in a reading list. Restoring the seeded state is a matter
of clearing the key and reloading:

```js
localStorage.removeItem("tbr.library.v1"); location.reload();
```

Any empty or corrupt value reseeds automatically, so deletion is the complete
procedure. The Open Library cache clears the same way:

```js
Object.keys(localStorage).filter(k => k.startsWith("tbr.cache")).forEach(k => localStorage.removeItem(k));
```

## How it is built

Next.js 16 (App Router), React 19, TypeScript and Tailwind v4, with no backend.
Open Library is called client-side and the library lives in `localStorage`, so
the application opens and runs from a URL with no login wall.

### The one architectural rule

> WebMCP tools never touch `localStorage` or React state directly. They call the
> same store the UI calls.

A tool writing around [the store](src/lib/store/store.ts) would leave an agent's
changes invisible until reload, removing the visible result of agent activity.
The store is an external store consumed through `useSyncExternalStore`, so
writes originating outside React re-render the tree without bridging code.

### Components: atoms → molecules → organisms

```
src/app/
  layout.tsx        fonts, theme bootstrap, metadata
  page.tsx          the shelf
  search/           catalogue search, add, Goodreads import
  taste/            the reading profile
  book/             one book: synopsis, subjects, shelf and rating.
                    `?id=` is a shelf id or an Open Library work key, so a
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

Pages hold the data and components hold none of it. `AppShell` performs start-up
once per session, so a reader arriving on a book page receives the same hydrated
library and registered tools as one arriving on the shelf.

### Humans first

TBR is a reading list that also speaks WebMCP, rather than a WebMCP
demonstration containing books. Agent status is a dot in the header corner that
opens a popover on click. Tool activity stays legible through toasts and a
highlight on the changed book, without a panel competing with the covers.

### The adapter

WebMCP is a live draft, and the implementations disagree about where the API
lives.

| | Namespace | Method |
|---|---|---|
| ChatGPT site tools | `document.modelContext` | `registerTool()` |
| Chrome imperative | `document.modelContext` | `registerTool()` |
| W3C proposal | `navigator.modelContext` | `provideContext()` |

Registering against the wrong one yields an application with no tools and no
error message. [`adapter.ts`](src/lib/webmcp/adapter.ts) detects the host at
runtime and supports both namespaces and both registration styles. Every
host-specific assumption in the codebase is confined to that file.

### Performance

Open Library sends no cache headers on `search.json`, so every reload refetched
the same data. [`cache.ts`](src/lib/catalog/cache.ts) places a bounded, TTL'd
`localStorage` cache in front of it, and a warm reload of a search or book page
issues no network requests. It fails soft in every direction: a cache that
throws is worse than no cache, and the library must never lose its storage slot
to one.

### Design

Warm editorial: paper-bone grounds, warm ink, and a single persimmon accent.
`Fraunces` for display, being variable, soft and slightly irregular; `Karla` for
UI; and `DM Mono` reserved for shelf metadata as a reference to library card
catalogues. Tokens are semantic (`paper`, `ink`) and swap wholesale for dark
mode, so no component carries a `dark:` variant.

## Deploying

The application is a static export (`output: "export"` in `next.config.ts`).
With no backend, no API routes and no server-side data, `npm run build` emits
`out/` at approximately 1.4MB, and that directory constitutes the entire site.

This makes it portable to any of the hackathon's accepted hosts. It is deployed
on Vercel, where `vercel --prod` publishes `out/` without server configuration.
ChatGPT Sites was considered and rejected on regional availability and
access-control defaults, neither of which was worth carrying against the
deadline; `out/` would deploy as readily to Netlify, Cloudflare Pages or Render.

On any host, WebMCP requires a secure context, so the site must be served over
HTTPS with no login wall in front of it. The full reasoning is in
[docs/05-architecture.md](docs/05-architecture.md#decision-vercel-rather-than-chatgpt-sites).

## Docs

The design documentation is in [docs/](docs/README.md): the hackathon brief, a
verified WebMCP API reference, tool design with the output-budget calculations,
architecture, the risk register, and the roadmap.

## Licence

[MIT](LICENSE).

# TBR — a reading list your agent can read too

A reading list that tracks what you want to read, what you finished, and what
you gave up on, and exposes all of it to AI agents as
[WebMCP](https://developer.chrome.com/docs/ai/webmcp) tools.

Built for the [WebMCP Challenge](https://webmcp.devpost.com).

> **Live demo:** <https://tbr-navy.vercel.app>

---

## Why WebMCP

Reading lists accumulate faster than they are read, and "what should I read
next?" is a question about taste. Answering it means weighing eighty books,
their ratings, and the ones that were abandoned, all at once.

A general browser agent could scrape the page, but WebMCP tool output is capped
at 1,500 characters. Eighty books with ratings do not fit, and paging through
them spends the agent's context on data it should never have had to parse.

TBR performs the aggregation instead. `get_taste_profile` reduces the whole
reading history on the site (favourite authors by mean rating, abandoned
authors, era distribution, finishing rate) to a compact response within the
tool budget, closing with a computed signal line:

```
Signal: Has given up on Neal Stephenson more than once.
```

The agent receives a hypothesis to reason from rather than a dataset to
interpret. That is the argument for WebMCP in one line: the site holds its own
data and can pre-compute the exact summary an agent needs.

## The tools

Seven, registered on the top-level page. The rationale is in
[docs/04-tool-design.md](docs/04-tool-design.md); the implementation is
[src/lib/webmcp/tools.ts](src/lib/webmcp/tools.ts).

| Tool | readOnly | destructive | idempotent | openWorld |
|---|---|---|---|---|
| `search_catalog` | yes | — | — | **yes** |
| `search_my_books` | yes | — | — | no |
| `get_taste_profile` | yes | — | — | no |
| `add_book` | no | **no** | yes | **yes** |
| `update_book` | no | **yes** | yes | no |
| `remove_book` | no | **yes** | yes | no |
| `navigate_to` | yes | — | — | no |

`search_catalog` also carries `untrustedContentHint`; `remove_book` also blocks
on `requestUserInteraction`. `destructive` and `idempotent` are meaningful only
when `readOnly` is false, so they are unset on the read tools. Nothing is left
to a default.

Five properties of the set are worth stating explicitly.

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
- **Nothing is left to an MCP default, because the defaults are pessimistic.**
  An unannotated mutating tool declares itself destructive, non-idempotent and
  open-world: silence is the loudest claim available. Writing them all out
  changed two answers — `openWorldHint` was wrong on five of seven tools, and
  `update_book` turned out to be genuinely destructive (it *replaces* a rating
  or shelf, and the spec's bar for `false` is "only additive updates"). It says
  so rather than describing the update as purely additive. Reasoning in
  [docs/04-tool-design.md](docs/04-tool-design.md).

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

### Starting over, and the demo library

The library starts **empty** and lives in `localStorage`. Nothing is
pre-populated: the shelf offers four ways to begin — search the catalogue, ask
an agent to read a photograph of your shelves, import a Goodreads CSV, or load
a demo library of 80 books curated so the taste profile has something real to
work with.

There is deliberately no reset *control*, since a control that erases a reading
list does not belong in a reading list. Two functions are on `window` instead:

```js
resetList()   // back to the empty first-run state
loadDemo()    // load the 80-book demo library
```

Both write through the store, so the shelf updates immediately — no reload. The
Open Library cache is separate and clears on its own key:

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
  book/             one book: synopsis, subjects, shelf, rating and date.
                    `?id=` is a shelf id or an Open Library work key, so a
                    search result and a shelf card lead to the same page

src/components/
  atoms/       Button  Chip  Icon  IconButton  ShelfDot  Spinner  Star  TextInput
  molecules/   BookCover  EmptyState  FilterBar  NavLink  SearchField
               ShelfBadge  SortControl  StarRating  StatFigure  ThemeToggle
  organisms/   AgentIndicator  BookCard  BookGrid  ConfirmDialog  FirstRunPanel
               ImportPanel  NavigationController  SiteHeader  TasteProfile
               ToastStack
  templates/   AppShell        ← header, page slot, global surfaces

src/lib/
  store/       store  profile  seed  goodreads  notifications  confirmations
               navigation  shelfView  useLibrary
  catalog/     openlibrary  cache                   ← Open Library client
  webmcp/      adapter  tools  format  input  register  activity
  utils/       cn  date  shelfDate  useHydrated
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
`out/`, and that directory constitutes the entire site.

The resulting static artefact is portable to any HTTPS static host. The live
site is deployed on Vercel, where `vercel --prod` builds the linked project from
source.

The deployment uses HTTPS and has no login wall. Deployment details are in
[docs/05-architecture.md](docs/05-architecture.md#deployment).

## Docs

The [design documentation](docs/README.md) covers the WebMCP API surface,
product journeys, tool schemas and output budgets, architecture, and
reproducible verification.

## Licence

[MIT](LICENSE).

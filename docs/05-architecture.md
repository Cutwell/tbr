# 05 — Architecture

## Guiding constraint

Five days, one deliverable: a public URL that works the first time a judge opens
it. Every choice below optimises for *nothing going wrong on someone else's
machine*.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router), React 19, TypeScript** | Statically exportable, one-step deploy, and `next/font` self-hosts the display faces. TypeScript earns its keep on the tool schemas, where a typo is invisible until an agent misbehaves. |
| Styling | **Tailwind v4** | Polish per hour, and Execution is a judged criterion. |
| State | External store + `useSyncExternalStore` | Tools and UI must mutate through *one* module so agent writes re-render the page. |
| Persistence | **`localStorage`** | No backend, no auth, no login wall. |
| Catalog | **Open Library**, called client-side | CORS `*`, no key. |
| Hosting | **Vercel** | Mature static host, no regional restriction, no access-control footgun. |

**No backend is a requirement, not a shortcut.** Judges must open a URL and use
it immediately. Accounts introduce a login wall between the judge and the demo,
and WebMCP tools that need auth are a much harder story to tell in three
minutes.

## The store is the integration point

The single most important structural rule in the codebase:

> **WebMCP tools never touch `localStorage` or React state directly. They call
> the same store the UI calls.**

```
        ┌──────────────┐
  UI ──▶│              │──▶ localStorage
        │   store.ts   │
tools ──▶│              │──▶ subscribers ──▶ React re-render
        └──────────────┘
```

If a tool wrote around the store, an agent's changes would not appear until
reload — and the entire visual payoff is books landing on the shelf as the agent
works. The store is an external store consumed through `useSyncExternalStore`,
so writes from outside React re-render the tree with no bridging code.

```ts
export const store = {
  all(): Book[],
  query(f: { shelf?, text?, minRating?, limit? }): Book[],
  add(input): { book: Book, duplicate: boolean },
  update(id, patch): Book | null,
  remove(id): Book | null,
  profile(): TasteProfile,
  subscribe(fn: () => void): () => void,
};
```

`store.profile()` is store-level rather than tool-level on purpose: the taste
profile is domain logic, so the UI can render it too. The `/taste` route is
nearly free once the computation exists, and it means the agent and the reader
are looking at the same analysis.

## File layout

```
src/app/
  layout.tsx     fonts, theme bootstrap, metadata
  page.tsx       the shelf
  search/        catalogue search, add, CSV import
  taste/         the reading profile
  book/          one book; ?id= is a shelf id or an Open Library work key

src/components/  atoms → molecules → organisms → templates
  templates/AppShell.tsx    header, page slot, global surfaces, start-up

src/lib/
  store/     store  profile  seed  notifications  confirmations  useLibrary
  catalog/   openlibrary  cache
  webmcp/    adapter  tools  format  input  register  activity
```

Pages hold the data; components hold none of it. `AppShell` runs start-up once
per session, so a reader landing on a book page gets the same hydrated library
and registered tools as one landing on the shelf.

`format.ts` exports the `ok()`/`err()` helpers, the pipe-table renderer, and a
`withinBudget()` guard that truncates at 1,500 characters *at a row boundary*
with an explicit marker. Cutting mid-row produces a malformed final row that
agents misparse — worse than a short table.

## Registration lifecycle

Register once, at start-up, **after** the store has hydrated. Registering first
means an early tool call can read an empty store.

All eight tools register together and never re-register
([04](04-tool-design.md)). When no host is available, the app says so plainly —
the agent indicator reads "unsupported" with a link to the setup instructions
rather than pretending. Judges may well open the URL in a plain browser first,
and that honesty is the difference between "broken" and "correctly detecting the
host".

## Seed data

**The highest-risk detail in the project.**

A judge opens the URL with empty `localStorage` and asks "what should I read
next?". `get_taste_profile` correctly reports *"not enough history yet"*,
`search_my_books` returns nothing, and the flagship journey produces nothing for
exactly the person it needed to impress.

So the app seeds **80 books** on first visit — 24 TBR, 47 read, 9 DNF — with
deliberate structure for the profile to find: a cluster of highly-rated Le Guin,
one author abandoned repeatedly, a pronounced skew towards older speculative
fiction, and enough TBR entries that "recommend one" is a real choice. Titles,
years and cover ids were resolved against the live API, so the shelf is a wall
of real cover art.

**There is no reset button, by design.** An earlier draft had one, on the
reasoning that judges experiment and need a way back. But a control that wipes
the reader's list has no business in a reading list, and it is exactly the sort
of thing that gets clicked by accident on camera. Resetting is a documented
one-liner in the README instead, which is the right audience for it — the people
who need it are running the app, not reading it. An empty or corrupt stored
value reseeds on hydrate, so deleting the key is the whole procedure.

## Catalog integration

```
GET https://openlibrary.org/search.json
    ?q={query}&limit={n}
    &fields=key,title,author_name,first_publish_year,cover_i
```

Covers come from `https://covers.openlibrary.org/b/id/{cover_i}-L.jpg`, also
CORS `*`.

What testing the live API taught, in rough order of how much time it saved:

- **Always send `fields`.** Without it a two-book response is 2,838 bytes,
  almost all ISBNs.
- **A bare work key finds nothing.** `q=OL3511459W` returns *zero* results; the
  index needs `q=key:/works/OL3511459W`. A quiet, expensive trap — a caller
  reading "no match" as "use what I was given" ends up shelving a book titled
  `OL3511459W`. Hence `lookupByKey`.
- **Relevance is weak.** "the dispossessed" ranks *The Lathe of Heaven* second.
  Show year and author everywhere so humans and agents can disambiguate.
- **Search returns translated editions.** Resolving "The Vegetarian" by author
  can return the Korean edition. Score candidates on title fidelity first, cover
  presence second; when only a translation exists, keep the reader's title and
  borrow that edition's cover.
- **`author_name` is an array** — take `[0]`.
- **`cover_i` is missing for roughly one work in 25** (3 of the 80 seeded). The
  typographic fallback sets the title in the display face on sunk paper, so it
  reads as a plain clothbound edition rather than as missing data.
- The human search box debounces at ~300ms. The tool path does not need it —
  agents call once.

### Covers

**Load them directly, not through the image optimiser.** A cover URL answers 302
into `archive.org` and then into a per-region `ia*.us.archive.org` host, so the
optimiser would make every cover depend on the server resolving that chain. This
is moot as well as prudent: a static export has no image optimiser at all. So a
plain `<img>`, not `next/image` — native `loading="lazy"` and CSS cover
everything the component would have added.

**One rendition. No `srcset`.** This was tried and reverted, and the failure is
worth recording. M is 180×294 (12KB) and L is 305×500 (26KB), so offering both
looks like free bytes on small screens. But the browser re-picks a candidate
once layout resolves `sizes`, and each re-pick **aborts the request in flight,
reporting a successful `load` with `naturalWidth === 0`**. Covers that had
loaded perfectly well were driven into the typographic fallback — 9 of 80
instead of the true 3, concentrated in the eagerly-loaded first row. One URL,
one request, no re-picks. L is the default, because a 190px grid cell on a 2×
display needs ~380px and M visibly softens there.

### Caching

Open Library sends **no cache headers on `search.json`**, so every reload
refetched everything. Covers carry `max-age=10800` and are the browser's
problem; the JSON was ours. `lib/catalog/cache.ts` is a bounded, TTL'd
`localStorage` cache in front of it — a week for searches, a month for work
details, both safe because book metadata is effectively immutable and a stale
entry is harmless.

It fails soft in every direction. A cache that throws is worse than no cache,
and the library must never lose its storage slot to one.

### Performance, measured

Production build, cold cache, 80-book shelf:

| | Before | After |
|---|---|---|
| App shell (DOMContentLoaded) | 219ms | unchanged — never the problem |
| Route swap | 18ms | unchanged — never the problem |
| Cover, median | 430ms | unchanged per image |
| `search.json` on reload | refetched every time | **0 requests** |
| Work detail on reload | refetched every time | **0 requests** |

**Route swaps were never slow.** What feels slow in development is Turbopack
compiling routes on demand. Measure against a production build or you will
optimise the wrong thing.

**Rejected: Google Books.** An unauthenticated request returned HTTP 429 on the
first try. Keyed access means a proxy, which means a backend. Not worth it when
Open Library works client-side.

## Deployment

### Hosting cannot win, only lose

Worth settling, because it looks like it might matter. It does not:

- **No prize is tied to a platform** — every sponsor prize goes to the same ten
  overall winners. There is no "best Vercel app" category.
- **The rules permit "any other provider"**, listing the sponsors as examples
  rather than a closed set.
- **Hosting is not a judging criterion.**

So the only thing hosting can do is lose marks on Execution, by failing when a
judge opens the URL. Choose for reliability and nothing else.

### Decision: Vercel, not ChatGPT Sites

ChatGPT Sites was the tempting choice — OpenAI's own surface, with documented
native support for site tools. It was investigated and dropped on three risks.
None is fatal alone; together they were not worth carrying against a deadline
when Vercel has none of them:

1. **Regional availability.** Reported as unavailable in the EEA, Switzerland
   and the UK. The docs neither confirm nor deny it, and this project is built
   in the UK.
2. **Access defaults.** A Site is only reachable without a ChatGPT account when
   sharing is explicitly set to "anyone on the Internet", and public publishing
   is **off by default** in Enterprise workspaces. A judge meeting a sign-in
   wall is the worst outcome available to this project.
3. **Maturity.** It shipped in July 2026 and is in public beta.

The upside was narrative rather than mechanical, and no prize depends on it.

### Why the app is a static export

TBR has no backend, no API route and no server data: Open Library is called from
the browser and the library lives in `localStorage`. The safest possible artefact
is therefore plain HTML, CSS and JS, which any host can serve. `next.config.ts`
sets `output: "export"`, `npm run build` emits `out/` (~1.4MB), and that
directory *is* the site. `vercel --prod` pushes it with no server config.

Static export forced one design decision. It cannot serve a dynamic segment
without `generateStaticParams`, and the build fails outright:

```
Error: Page "/book/[id]" is missing "generateStaticParams()" so it cannot be
used with "output: export"
```

Book ids are runtime values — local uuids and arbitrary Open Library work keys —
so they cannot be enumerated at build time. The route is therefore
**`/book?id=…`**, a static page reading `useSearchParams`. This turned out to be
a net win: a query parameter also removes the RSC round trip a dynamic segment
costs on every navigation.

Two consequences worth remembering: `next start` no longer applies — serve `out/`
instead, and measure production behaviour there — and there is no image
optimiser, which makes loading covers directly required rather than merely
prudent.

### Deployment checklist

- [x] Served over **HTTPS** — WebMCP requires a secure context
- [x] Publicly reachable, no login or interstitial
- [x] Tools register from the **top-level page**, never an iframe (ChatGPT does
      not discover tools inside iframes)
- [x] Origin-isolated; `document.domain` is never set, and the `tools`
      Permissions Policy is left at its `self` default
- [x] `openlibrary.org` and `covers.openlibrary.org` reachable from the browser —
      both send CORS `*`, and Vercel sets no CSP by default
- [ ] Open the deployed URL in the ChatGPT browser on a **cold profile**, on a
      machine that has never run the dev server, and confirm the indicator reads
      **8 tools live**

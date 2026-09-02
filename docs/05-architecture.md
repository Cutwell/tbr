# 05 — Architecture

## Governing constraint

The application must work on first open from a public URL without an account or
server-side setup. Every choice below supports that constraint.

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript | Statically exportable, deploys in one step, and `next/font` self-hosts the display faces. TypeScript is most valuable on the tool schemas, where a typo is undetectable until an agent misbehaves. |
| Styling | Tailwind v4 | Utility classes keep the visual system consistent without a runtime styling layer. |
| State | External store with `useSyncExternalStore` | Tools and UI must mutate through one module so that agent writes re-render the page. |
| Persistence | `localStorage` | No backend, no authentication, no login wall. |
| Catalogue | Open Library, called client-side | CORS `*`, no API key. |
| Hosting | Vercel | Serves the static export over HTTPS from a linked project. |

The absence of a backend keeps the application immediately usable. There is no
account or authentication boundary, and the WebMCP tools operate on the same
browser-local library as the interface.

## The store as integration point

The primary structural rule in the codebase:

> WebMCP tools never touch `localStorage` or React state directly. They call the
> same store the UI calls.

```
        ┌──────────────┐
  UI ──▶│              │──▶ localStorage
        │   store.ts   │
tools ──▶│              │──▶ subscribers ──▶ React re-render
        └──────────────┘
```

A tool writing around the store would leave the agent's changes invisible until
reload, which removes the visible result of agent activity. The store is an
external store consumed through `useSyncExternalStore`, so writes originating
outside React re-render the tree without bridging code.

```ts
export const library = {
  all(): readonly Book[],
  query(f: { shelf?, text?, minRating?, limit? }): { results: Book[], total: number },
  add(input): { book: Book, duplicate: boolean },
  update(id, patch): Book | null,
  remove(id): Book | null,
  profile(): TasteProfile,
  subscribe(fn: () => void): () => void,
};
```

`store.profile()` sits at store level rather than tool level because the taste
profile is domain logic. Locating it there allows the UI to render it as well:
the `/taste` route costs almost nothing once the computation exists, and the
agent and the reader consume the same analysis.

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
  store/     store  profile  seed  goodreads  notifications  confirmations
             navigation  shelfView  useLibrary
  catalog/   openlibrary  cache
  webmcp/    adapter  tools  format  input  register  activity
  utils/     cn  date  shelfDate  useHydrated
```

Pages hold data; components hold none. `AppShell` performs start-up once per
session, so a reader arriving on a book page receives the same hydrated library
and registered tools as one arriving on the shelf.

`format.ts` exports the `ok()` and `err()` helpers, the pipe-table renderer, and
a `withinBudget()` guard truncating at 1,500 characters on a row boundary with
an explicit marker. Cutting mid-row produces a malformed final row that agents
misparse, which is worse than a table that is visibly short.

## Registration lifecycle

Registration runs once at start-up, after the store has hydrated. The reverse
order permits an early tool call to read an empty store.

All seven tools register together and are never re-registered
([04-tool-design.md](04-tool-design.md)). Where no host is available, the agent
indicator reports "unsupported" and links to setup instructions. The explicit
state distinguishes correct host detection from a broken page.

## First run, and the demo library

A reader opening the URL with empty `localStorage` and asking what to read next
would receive an accurate report of insufficient history from
`get_taste_profile` and an empty result from `search_my_books`. The primary
journey would produce nothing for the intended audience.

**The library now starts empty**, and the shelf renders `FirstRunPanel` in
place of the grid: four real ways in, ordered so that the two which add the
reader's *own* books come first.

| Route | Goes to |
|---|---|
| Search the catalogue | `/search` |
| Ask your agent — photograph a shelf, have it add what it reads | in place, when a host is present |
| Import from Goodreads | `/search?import=1`, panel open on arrival |
| Load the demo library | `library.loadDemo()` |

The demo set is curated rather than random, so the profile
has structure to find: a cluster of highly-rated Le Guin, one author abandoned
repeatedly, a pronounced skew toward older speculative fiction, and enough TBR
entries for a recommendation to constitute a real choice. Titles, years and
cover ids were resolved against the live API, so covers render. It is now
something a reader chooses, one option among four, rather than something
applied to them.

The agent route adapts to the host: it promises an agent only when one is
actually registered and not merely polyfilled, since the polyfill registers
tools no external agent can see. Otherwise it names the browsers where it works.

An empty library is now a first-class state rather than a signal to reseed —
`hydrate` respects a stored `[]` exactly as it respects a stored 80. That is
what makes a reset stick across a reload.

### Resetting

There is no reset control in the interface, where accidental activation would
erase the reader's list. The store instead exposes two explicit console
functions on `window`:

```js
resetList()   // back to the empty first-run state
loadDemo()    // the 80-book demo library
```

Both write through the store, so the shelf re-renders immediately with no
reload. A one-line `console.info` on start-up makes them discoverable.

## Catalogue integration

```
GET https://openlibrary.org/search.json
    ?q={query}&limit={n}
    &fields=key,title,author_name,first_publish_year,cover_i
```

Covers are served from `https://covers.openlibrary.org/b/id/{cover_i}-L.jpg`,
also CORS `*`.

Findings from testing against the live API:

- **`fields` is mandatory in practice.** Unprojected responses contain large
  identifier arrays and other fields the application does not use.
- **A bare work key matches nothing.** `q=OL3511459W` returns zero results; the
  index requires `q=key:/works/OL3511459W`. The failure is quiet and expensive:
  a caller interpreting "no match" as "use the supplied value" shelves a book
  titled `OL3511459W`. `lookupByKey` handles this.
- **`q` is a Lucene query string, not a free-text box** — the `key:` syntax
  above is the proof. Handing it a human's phrasing unmodified breaks the single
  most natural way to search for a book. Measured against the live API:

  | Query | Result |
  |---|---|
  | `The Dispossessed - Ursula Le Guin` | 0 results |
  | `The Dispossessed by Ursula Le Guin` | 1 result, and it is *The Lathe of Heaven* |
  | `Sold by Patricia McCormick` | 0 results |

  Two causes. A `-` that *opens a token* is Lucene's NOT operator, so the usual
  "Title - Author" separator asks Open Library to exclude the author, which can
  never match. And terms are AND-ed, so `by` becomes a required term the record
  must physically contain. `normalizeQuery` neutralises both, and every case
  above then returns the right book first.

  It is specifically token-*initial* dashes that are operators: `Slaughterhouse-Five`
  and `Spider-Man` search correctly and must keep doing so, which is why a
  blanket strip would be a regression. `searchCatalog` normalises; `lookupByKey`
  calls the raw path, because its `key:` prefix is deliberate syntax.
- **Relevance ranking is imprecise.** "the dispossessed" ranks *The Lathe of
  Heaven* second, so year and author appear everywhere to support
  disambiguation.
- **Searches return translated editions.** Resolving "The Vegetarian" by author
  can return the Korean edition. Candidates are scored on title fidelity first
  and cover presence second; where only a translation exists, the reader's title
  is retained and that edition's cover borrowed.
- **`author_name` is an array**, and the first element is used.
- **`cover_i` is absent for roughly one work in 25**, three of the 80 in the
  demo library.
  The typographic fallback sets the title in the display face on sunk paper, so
  it reads as a plain clothbound edition rather than as missing data.
- The reader-facing search field debounces at approximately 300ms. The tool path
  does not require debouncing, as agents call once.

### Covers

Covers load directly rather than through the image optimiser. A cover URL
answers 302 into `archive.org` and then into a per-region `ia*.us.archive.org`
host, which would make every cover dependent on the server resolving that chain.
The point is now moot as well as prudent, since a static export has no image
optimiser. The component is a plain `<img>` rather than `next/image`; native
`loading="lazy"` and CSS supply everything the component would have added.

A single large rendition is used without `srcset`. One stable URL avoids
candidate re-selection during layout, while the typographic fallback handles
works without cover art.

### Caching

Open Library sends no cache headers on `search.json`, so every reload refetched
the same data. Covers carry `max-age=10800` and are handled by the browser; the
JSON was not. `lib/catalog/cache.ts` places a bounded, TTL'd `localStorage`
cache in front of it, with a week for searches and a month for work details.
Both are safe because book metadata is effectively immutable and a stale entry
is harmless.

The cache fails soft in every direction. A cache that throws is worse than no
cache, and the library must never lose its storage slot to one.

On a warm reload, cached search and work-detail entries avoid repeat JSON
requests. Covers remain browser-cached independently.

## Deployment

TBR has no backend, no API routes and no server-side data: Open Library is called
from the browser and the library lives in `localStorage`. The safest artefact is
therefore plain HTML, CSS and JavaScript, which any host can serve.
`next.config.ts` sets `output: "export"`, and `npm run build` emits `out/`.
Vercel builds the linked project from source; the same output can be served by
any HTTPS static host.

Static export forced one routing decision. It cannot serve a dynamic segment
without `generateStaticParams`, and the build fails outright:

```
Error: Page "/book/[id]" is missing "generateStaticParams()" so it cannot be
used with "output: export"
```

Book ids are runtime values, comprising local uuids and arbitrary Open Library
work keys, and cannot be enumerated at build time. The route is therefore
`/book?id=…`, a static page reading `useSearchParams`. The result is a net
improvement beyond portability, since a query parameter also removes the RSC
round trip that a dynamic segment incurs on every navigation.

Two consequences follow. `next start` no longer applies, so production behaviour
must be measured by serving `out/`. And there is no image optimiser, which makes
loading covers directly a requirement rather than a preference.

Deployment and bundle checks are documented in
[06-verification.md](06-verification.md).

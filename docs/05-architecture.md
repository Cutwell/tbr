# 05 — Architecture

## Governing constraint

The deliverable is a public URL that works on first open, on an unfamiliar
machine, within a five-day window. Every choice below optimises for that.

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript | Statically exportable, deploys in one step, and `next/font` self-hosts the display faces. TypeScript is most valuable on the tool schemas, where a typo is undetectable until an agent misbehaves. |
| Styling | Tailwind v4 | Highest visual return per hour, and Execution is a judged criterion. |
| State | External store with `useSyncExternalStore` | Tools and UI must mutate through one module so that agent writes re-render the page. |
| Persistence | `localStorage` | No backend, no authentication, no login wall. |
| Catalogue | Open Library, called client-side | CORS `*`, no API key. |
| Hosting | Vercel | Mature static host without regional restrictions or access-control defaults that could block a judge. |

The absence of a backend is a requirement rather than a simplification. Judges
must open a URL and use it immediately; accounts introduce a login wall between
the judge and the demonstration, and WebMCP tools requiring authentication are a
substantially harder story to present in three minutes.

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
  store/     store  profile  seed  notifications  confirmations  useLibrary
  catalog/   openlibrary  cache
  webmcp/    adapter  tools  format  input  register  activity
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
indicator reports "unsupported" and links to setup instructions. Judges are
likely to open the URL in an ordinary browser first, and an explicit unsupported
state distinguishes correct host detection from a broken page.

## Seed data

A judge opening the URL with empty `localStorage` and asking what to read next
would receive an accurate report of insufficient history from
`get_taste_profile` and an empty result from `search_my_books`. The primary
journey would produce nothing for the intended audience.

The application therefore seeds 80 books on first visit: 24 TBR, 47 read, 9 DNF.
The history is curated rather than random so that the profile has structure to
find, including a cluster of highly-rated Le Guin, one author abandoned
repeatedly, a pronounced skew toward older speculative fiction, and enough TBR
entries for a recommendation to constitute a real choice. Titles, years and
cover ids were resolved against the live API, so covers render.

There is no reset control in the interface. An earlier draft included one on the
reasoning that judges experiment and need a way back, but a control that erases
the reader's list does not belong in a reading list, and it invites accidental
activation during a recording. Resetting is documented in the README as a
`localStorage` deletion, which reaches the audience that needs it. An empty or
corrupt stored value reseeds on hydrate, so deleting the key is the complete
procedure.

## Catalogue integration

```
GET https://openlibrary.org/search.json
    ?q={query}&limit={n}
    &fields=key,title,author_name,first_publish_year,cover_i
```

Covers are served from `https://covers.openlibrary.org/b/id/{cover_i}-L.jpg`,
also CORS `*`.

Findings from testing against the live API:

- **`fields` is mandatory in practice.** Without it, a two-book response is
  2,838 bytes, almost entirely ISBNs.
- **A bare work key matches nothing.** `q=OL3511459W` returns zero results; the
  index requires `q=key:/works/OL3511459W`. The failure is quiet and expensive:
  a caller interpreting "no match" as "use the supplied value" shelves a book
  titled `OL3511459W`. `lookupByKey` handles this.
- **Relevance ranking is imprecise.** "the dispossessed" ranks *The Lathe of
  Heaven* second, so year and author appear everywhere to support
  disambiguation.
- **Searches return translated editions.** Resolving "The Vegetarian" by author
  can return the Korean edition. Candidates are scored on title fidelity first
  and cover presence second; where only a translation exists, the reader's title
  is retained and that edition's cover borrowed.
- **`author_name` is an array**, and the first element is used.
- **`cover_i` is absent for roughly one work in 25**, three of the 80 seeded.
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

A single rendition is used, with no `srcset`. This was attempted and reverted;
the failure mode is recorded here because it is non-obvious. M measures
180×294 (12KB) and L measures
305×500 (26KB), so offering both appears to be a free saving on small screens.
However, the browser re-selects a candidate once layout resolves `sizes`, and
each re-selection aborts the in-flight request while reporting a successful
`load` with `naturalWidth === 0`. Covers that had loaded correctly were driven
into the typographic fallback, producing 9 of 80 rather than the true 3, and
concentrated in the eagerly-loaded first row. One URL means one request and no
re-selection. L is the default because a 190px grid cell on a 2× display
requires approximately 380px, at which M visibly softens.

### Caching

Open Library sends no cache headers on `search.json`, so every reload refetched
the same data. Covers carry `max-age=10800` and are handled by the browser; the
JSON was not. `lib/catalog/cache.ts` places a bounded, TTL'd `localStorage`
cache in front of it, with a week for searches and a month for work details.
Both are safe because book metadata is effectively immutable and a stale entry
is harmless.

The cache fails soft in every direction. A cache that throws is worse than no
cache, and the library must never lose its storage slot to one.

### Measured performance

Production build, cold cache, 80-book shelf.

| Metric | Before | After |
|---|---|---|
| App shell (DOMContentLoaded) | 219ms | unchanged; never the bottleneck |
| Route swap | 18ms | unchanged; never the bottleneck |
| Cover, median | 430ms | unchanged per image |
| `search.json` on reload | refetched every time | 0 requests |
| Work detail on reload | refetched every time | 0 requests |

Route swaps were never slow. Apparent slowness during development is Turbopack
compiling routes on demand, so measurements taken against the dev server
describe the bundler rather than the application.

Google Books was evaluated and rejected. An unauthenticated request returned
HTTP 429 on the first attempt, and keyed access would require a proxy and
therefore a backend, which is not justified when Open Library works client-side.

## Deployment

### Platform choice cannot add marks

The question is settled explicitly here because it appears to carry more weight
than it does.

- No prize is tied to a platform. Every sponsor prize goes to the same ten
  overall winners, and there is no per-platform category.
- The rules permit "any other provider", listing the sponsors as examples rather
  than a closed set.
- Hosting is not among the judging criteria.

Hosting can therefore only lose marks, by failing on Execution when a judge
opens the URL. Reliability is the only relevant selection criterion.

### Decision: Vercel rather than ChatGPT Sites

ChatGPT Sites was the more interesting option, being OpenAI's own surface with
documented native support for site tools. It was investigated and rejected on
three risks. None is individually fatal; together they were not worth carrying
against the deadline given that Vercel presents none of them.

1. **Regional availability.** Reported as unavailable in the EEA, Switzerland
   and the UK. The documentation neither confirms nor denies this, and the
   project is built in the UK.
2. **Access defaults.** A Site is reachable without a ChatGPT account only when
   sharing is explicitly set to "anyone on the Internet", and public publishing
   is disabled by default in Enterprise workspaces. A judge encountering a
   sign-in wall is the worst available outcome.
3. **Maturity.** The product shipped in July 2026 and remains in public beta.

The advantage was presentational rather than technical, and no prize depends on
the choice.

### Static export

TBR has no backend, no API routes and no server-side data: Open Library is called
from the browser and the library lives in `localStorage`. The safest artefact is
therefore plain HTML, CSS and JavaScript, which any host can serve.
`next.config.ts` sets `output: "export"`, `npm run build` emits `out/` at
approximately 1.4MB, and that directory constitutes the site. `vercel --prod`
publishes it without server configuration.

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

### Deployment checklist

- [x] Served over HTTPS, as WebMCP requires a secure context
- [x] Publicly reachable, with no login or interstitial
- [x] Tools registered from the top-level page, never an iframe, since ChatGPT
      does not discover tools inside iframes
- [x] Origin-isolated; `document.domain` is never set, and the `tools`
      Permissions Policy remains at its `self` default
- [x] `openlibrary.org` and `covers.openlibrary.org` reachable from the browser;
      both send CORS `*`, and Vercel sets no CSP by default
- [ ] Deployed URL opened in the ChatGPT browser on a cold profile, on a machine
      that has never run the dev server, with the indicator reading "7 tools
      live"

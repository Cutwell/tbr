# 05 — Architecture

## Guiding constraint

Five days, one deliverable: a public URL that works the first time a judge opens
it. Every choice below optimises for *nothing to go wrong on someone else's
machine*.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19 + TypeScript** | Static-exportable, deploys to Vercel or Netlify in one step, and `next/font` self-hosts the display faces. TS earns its keep on the tool schemas, where a typo is invisible until an agent misbehaves. |
| Styling | **Tailwind** | Polish per hour is what matters; "Execution" is a judged criterion. |
| State | External store + `useSyncExternalStore` | Tools and UI must mutate through *one* module so agent writes re-render the UI. See below. |
| Persistence | **`localStorage`** | No backend, no auth, no login wall. |
| Catalog | **Open Library**, called client-side | Verified CORS `*`, no key. |
| Hosting | **Vercel** or **Netlify** | Both are sponsors with prize credits. Static SPA deploy, custom domain, HTTPS by default. |

**No backend.** Not a shortcut — a requirement. Judges must open a URL and use it
immediately; anything with accounts introduces a login wall between the judge and
the demo, and WebMCP tools that need auth are a much harder story to tell in
three minutes.

## The store is the integration point

The single most important structural rule in the codebase:

> **WebMCP tools must never touch `localStorage` or React state directly. They
> call the same store module the UI calls.**

```
        ┌──────────────┐
  UI ──▶│              │
        │  store.ts    │──▶ localStorage
tools ─▶│  (single     │──▶ subscribers ──▶ React re-render
        │   source)    │
        └──────────────┘
```

If a tool writes around the store, the agent's changes will not appear on screen
until reload — which destroys the demo, because the entire visual payoff is
books appearing live as the agent works. Make the store an event emitter and
subscribe the UI to it.

```ts
// store.ts — shape, not implementation
export const store = {
  all(): Book[],
  query(f: {shelf?, text?, minRating?, limit?}): Book[],
  add(input): {book: Book, duplicate: boolean},
  update(id, patch): Book | null,
  remove(id): Book | null,
  profile(): TasteProfile,
  subscribe(fn: () => void): () => void
};
```

`store.profile()` is deliberately store-level rather than tool-level: the
taste profile is domain logic, and having it in the store means the UI can show
it too (a "your reading in numbers" panel is nearly free once it exists, and it
looks good on camera).

## File layout

```
src/
  webmcp/
    adapter.ts      # namespace shim — document vs navigator (see doc 02)
    tools.ts        # the 7 descriptors + execute handlers
    format.ts       # ok()/err() helpers, pipe-table renderer, 1.5K budget guard
    register.ts     # called once at app start
  store/
    store.ts        # single source of truth
    profile.ts      # taste profile computation
    seed.ts         # demo library (see below)
  catalog/
    openlibrary.ts  # search + field projection + cover URLs
  ui/
    Shelf.tsx  AddBook.tsx  Import.tsx  BookCard.tsx  AgentActivity.tsx
```

`format.ts` should export a `budget()` guard that truncates at 1,500 characters
*and appends a marker* rather than cutting mid-row — silent truncation produces
malformed final rows that agents misparse.

## Seed data — do not skip this

**The highest-risk detail in the whole project.**

A judge opens the URL with an empty `localStorage`. They ask the agent "what
should I read next?". `get_taste_profile` correctly reports *"not enough history
yet"*, `search_my_books` returns nothing, and the flagship journey — the one the
whole submission is built on — produces nothing at all. The demo fails for
exactly the person it needed to impress.

**Mitigation: seed a realistic library on first visit.** Roughly 60–90 books
across all three shelves with plausible ratings, spread across authors and
decades so `get_taste_profile` produces a genuinely interesting output. Include
deliberate signal:

- 3–4 books by one author, all rated 4–5★ (gives "Loved")
- 2 DNFs from one author (gives "Disliked")
- A clear era skew (gives the era breakdown)
- Enough TBR entries (~20) that "recommend one" is a real choice

**Do not add a reset button.** It was in an earlier draft on the reasoning that
judges experiment and need a way back — but a control that wipes the reader's
list has no business in a reading list, and it is the sort of thing that gets
clicked by accident on camera. Resetting is a documented one-liner in the README
instead (`localStorage.removeItem("tbr.library.v1")`), which is the right
audience for it: the people who need it are running the app, not reading it.

An empty or corrupt stored value reseeds on hydrate, so deleting the key is the
whole procedure.

Generate the seed from Open Library so covers are real — a wall of real cover art
is most of the visual quality of this app.

## Registration lifecycle

Register once, at app start, after the store has hydrated:

```ts
// main.tsx
await store.hydrate();          // seed if empty
const registered = await registerTools(tools);
setAgentStatus(registered ? 'ready' : 'unsupported');
```

Order matters: registering before hydration means an early tool call can read an
empty store.

When WebMCP is unavailable (any normal browser), show a quiet, honest banner —
*"Open in ChatGPT or Chrome with WebMCP enabled to use agent features"* — with a
link to the setup instructions. Judges may open the URL in a plain browser first;
that banner is the difference between "broken" and "correctly detecting the
host".

## Catalog integration

```
GET https://openlibrary.org/search.json
    ?q={query}
    &limit={n}
    &fields=key,title,author_name,first_publish_year,cover_i
```

Covers: `https://covers.openlibrary.org/b/id/{cover_i}-M.jpg`
(also CORS `*`; `-S`/`-M`/`-L` sizes).

Practical notes from testing the live API:

- **Always send `fields`.** Without it a two-book response is 2,838 bytes, almost
  all ISBNs.
- **Relevance is weak.** "the dispossessed" ranks *The Lathe of Heaven* second.
  Show year + author in the UI and in tool output so humans and agents can
  disambiguate.
- **`author_name` is an array** — take `[0]`.
- **`cover_i` is missing for roughly 1 work in 25** (3 of the 80 seeded). The
  typographic fallback sets the title in the display face on sunk paper, so it
  reads as a plain clothbound edition rather than as missing data.
- **Search returns translated editions.** Resolving "The Vegetarian" by author
  can return the Korean edition. Score candidates on title fidelity first, cover
  presence second; when only a translation exists, keep the reader's title and
  borrow that edition's cover.
- **A bare work key finds nothing.** `q=OL3511459W` returns *zero* results; the
  search index needs `q=key:/works/OL3511459W`. This is a quiet, expensive trap:
  a caller that reads "no match" as "use what I was given" ends up shelving a
  book titled "OL3511459W". Use `lookupByKey`.
- Add a **debounce (~300ms)** on the human search box. The tool path needs no
  debounce — agents call once.

### Covers

- **Load them directly, not through the image optimiser.** A cover URL answers
  302 into `archive.org` and then into a per-region `ia*.us.archive.org` host,
  so the optimiser makes every cover depend on the *server* resolving that
  chain. This is now moot as well as prudent: the app is statically exported,
  and static export has no image optimiser at all.
- That means a plain `<img>`, not `next/image`. Once covers load directly, the
  component contributes nothing native `loading="lazy"` and CSS do not.
- **One rendition. Do not add a `srcset`.** This was tried and reverted, and the
  failure is worth recording. Renditions measure M 180×294 (12KB) and L 305×500
  (26KB), so offering both looks like free bytes on small screens. But the
  browser re-picks a candidate once layout resolves `sizes`, and each re-pick
  **aborts the request in flight — reporting a successful `load` with
  `naturalWidth === 0`**. Covers that had loaded perfectly well were driven into
  the typographic fallback: 9 of 80 instead of the true 3, concentrated in the
  eagerly-loaded first row. A delayed re-check recovered only some. One URL, one
  request, no re-picks; the bytes were not worth randomly losing cover art.
- `L` is the default. A 190px grid cell on a 2× display needs ~380px, and M
  visibly softens there.
- **`cover_i` is missing for roughly 1 work in 25** (3 of the 80 seeded).

### Performance, measured

Production build (`next start`, not `next dev`), cold cache, 80-book shelf:

| | Before | After |
|---|---|---|
| App shell (DOMContentLoaded) | 219ms | unchanged — never the problem |
| Route swap (RSC fetch for `/book/[id]`) | 18ms | unchanged — never the problem |
| Cover, median | 430ms | ~880ms with all 80 in flight; unchanged per-image |
| `search.json` on reload | refetched every time | **0 requests** |
| Work detail on reload | refetched every time | **0 requests** |

Two things worth knowing before optimising anything here:

1. **Route swaps were never slow.** What feels slow in development is Turbopack
   compiling routes on demand. Measure against `next start` or you will optimise
   the wrong thing.
2. **Open Library sends no cache headers on `search.json`.** Covers carry
   `max-age=10800`, so they are the browser's problem; JSON was ours, refetched
   on every reload. Hence `lib/catalog/cache.ts` — a bounded, TTL'd
   `localStorage` cache. Book metadata is effectively immutable, so a week
   (searches) and a month (work details) are safe and a stale entry is harmless.
   It fails soft in every direction: a cache that throws is worse than no cache,
   and the library must never lose its storage slot to one.

**Rejected: Google Books.** An unauthenticated request from this machine returned
**HTTP 429** on the first try. Keyed access would mean a proxy, which means a
backend. Not worth it when Open Library works client-side.

## Deployment

### Does the platform affect the result? No.

Worth settling, because it looks like it might. It does not:

- **No prize is tied to a platform.** Every sponsor prize — OpenAI's $3,000,
  Vercel's credits, Netlify's $500, Cloudflare's, Render's, Shopify's — goes to
  the same ten overall winners. There is no "best Vercel app" category.
- **The rules permit "any other provider"**, listing ChatGPT Sites, Cloudflare,
  Vercel, Render and Netlify as examples rather than a closed set.
- **Hosting is not a judging criterion.** The four are WebMCP Leverage,
  Execution, Potential Impact, and Creativity & Ambition.

So the only thing hosting can do is *lose* marks, by failing on Execution if the
URL does not work when a judge opens it. Choose for reliability, nothing else.

### Decision: Vercel, not ChatGPT Sites

**Deployed.** TBR is live on Vercel — see the README for the URL. ChatGPT
Sites was investigated and dropped before submission, on the strength of the
three risks below; none were fatal individually, but together they weren't
worth carrying against a deadline when Vercel has none of them:

1. **Regional availability.** Reported as unavailable in the EEA, Switzerland
   and the UK. The official docs neither confirm nor deny it, and this project
   is built in the UK.
2. **Access defaults.** A Site is only reachable without a ChatGPT account when
   sharing is explicitly set to *"anyone on the Internet"* — and public
   publishing is **off by default** in Enterprise workspaces. Any other mode
   requires a signed-in, invited viewer. A judge meeting a sign-in wall is the
   worst outcome available to this project.
3. **Maturity.** It shipped in July 2026 and is in public beta.

Its genuine upside was narrative rather than mechanical: it is OpenAI's own
surface, and Sites documents native support for site tools. Not worth the
submitted URL depending on it, given no prize is tied to the hosting choice
(see above).

**Vercel** is a mature static host with no regional restriction and no
access-control footgun — the safe primary this project needed. The build is a
portable static export, so nothing about this decision is permanent: `out/`
deploys as-is to any other host in one command if that ever changes.

### Why the app is a static export

Sites hosts "web experiences that run in the supported Sites runtime" and warns
that "some frameworks, private networks, databases, background services, and
hosting patterns aren't supported". Its storage primitives are **D1** and
**R2** — Cloudflare — so it is a Workers-class runtime, not Node.

TBR needs none of that. There is no backend, no API route and no server data:
Open Library is called from the browser and the library lives in
`localStorage`. So the safest possible artefact is plain HTML, CSS and JS, which
any host can serve. `next.config.ts` sets:

```ts
output: "export"
```

`npm run build` then emits `out/` (~1.4MB), and that directory *is* the site.

### What this forced

Static export cannot serve a dynamic segment without `generateStaticParams`, and
the build fails outright:

```
Error: Page "/book/[id]" is missing "generateStaticParams()" so it cannot be
used with "output: export"
```

Book ids are runtime values — local uuids and arbitrary Open Library work keys —
so they cannot be enumerated at build time. The route is therefore
**`/book?id=…`**, a static page reading `useSearchParams`. This is a net win
beyond portability: a query parameter also removes the RSC round trip that a
dynamic segment costs on every navigation.

Two consequences worth remembering:

- **`next start` no longer applies.** Serve `out/` instead — the `tbr-static`
  launch config runs `npx serve out`. Measure production behaviour there.
- **There is no image optimiser in a static export.** Loading covers directly is
  now required rather than merely prudent.

### Deploying

`vercel --prod` builds and pushes `out/` directly — no server config needed,
since the artefact is plain static files. The project is already linked
(`.vercel/project.json`), so a redeploy after any future change is that one
command.

Checks that matter for this app specifically:

- [x] The site is served over **HTTPS** — WebMCP requires a secure context
- [x] **No login or interstitial** in front of the page
- [x] Tools register from the **top-level page**, never an iframe (ChatGPT does
      not discover tools inside iframes)
- [x] `covers.openlibrary.org` and `openlibrary.org` are reachable from the
      browser — both send `access-control-allow-origin: *`, and Vercel sets no
      CSP by default
- [ ] Open the deployed URL in the ChatGPT browser and confirm the agent
      indicator reads **"7 tools live"** — do this against the live Vercel URL,
      not just localhost

## Deployment checklist

- [x] HTTPS, publicly reachable, no login or interstitial (Vercel default)
- [x] Origin-isolated; do **not** set `document.domain`
- [x] Tools registered from the **top-level page**, never an iframe
  (ChatGPT does not discover tools in iframes)
- [x] `tools` Permissions Policy defaults to `self` — do not override it
- [ ] Verify on a **cold profile** with empty `localStorage`, in the ChatGPT
      in-app browser, on a machine that never ran the dev server

# 05 — Architecture

## Guiding constraint

Five days, one deliverable: a public URL that works the first time a judge opens
it. Every choice below optimises for *nothing to go wrong on someone else's
machine*.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite + React + TypeScript** | Fastest path to a polished SPA. TS earns its keep on the tool schemas, where a typo is invisible until an agent misbehaves. |
| Styling | **Tailwind** | Polish per hour is what matters; "Execution" is a judged criterion. |
| State | React state + a thin store module | Tools and UI must mutate through *one* module so agent writes re-render the UI. See below. |
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

Add a visible **"Reset demo library"** control. Judges will experiment; the
ability to get back to a good state costs an hour and saves the submission.

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
- **`cover_i` is often missing.** Design a decent typographic fallback cover;
  a grid of grey boxes will undercut the polish the demo depends on.
- Add a **debounce (~300ms)** on the human search box. The tool path needs no
  debounce — agents call once.
- No key and no rate limit documented, but be a good citizen: cache identical
  queries in memory for the session.

**Rejected: Google Books.** An unauthenticated request from this machine returned
**HTTP 429** on the first try. Keyed access would mean a proxy, which means a
backend. Not worth it when Open Library works client-side.

## Deployment checklist

- [ ] Custom-ish domain, HTTPS (WebMCP requires a secure context)
- [ ] No login, no cookie wall, no interstitial
- [ ] Origin-isolated; do **not** set `document.domain`
- [ ] Tools registered from the **top-level page**, never an iframe
  (ChatGPT does not discover tools in iframes)
- [ ] `tools` Permissions Policy defaults to `self` — do not override it
- [ ] Verify on a **cold profile** with empty `localStorage`, in the ChatGPT
      in-app browser, on a machine that never ran the dev server

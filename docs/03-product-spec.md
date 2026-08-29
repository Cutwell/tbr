# 03 — Product Spec

## What TBR is

A personal reading list. Books live on one of three shelves — **TBR**, **Read**,
**DNF** (did not finish) — and carry an optional 1–5 star rating.

The app must be genuinely good *without* an agent. The "Execution" judging
criterion asks for "a working product with complete experience", and a demo that
is only a tool harness reads as a prototype. The agent makes it better; it is
not the only way in.

## Human user journeys

These are the user's stated requirements, with implementation notes.

### J1 — Add a book
Search by title or author, pick from results, it lands on **TBR** by default.
Search is against the Open Library catalog, so results arrive with author, first
publication year, and cover art already attached — the user types a few
characters, not a form.

*Note:* also allow a manual "add by title" escape hatch for books the catalog
lacks or gets wrong. Cheap to build, and it prevents a dead end on camera.

### J2 — Change shelf
Move a book to **Read** or **DNF**. One tap from the card, no dialog.

*Note:* moving to Read is the natural moment to prompt for a rating — do it
inline rather than as a separate journey.

### J3 — View and filter
The list view, with filter chips for **TBR / Read / DNF**. Chips should show
counts (`TBR 24`) — cheap, and it makes the shelf feel substantial on camera.

### J4 — Remove a book
Delete entirely. Destructive and unrecoverable, so it needs confirmation in the
UI *and* `requestUserInteraction` on the agent path. See [04](04-tool-design.md).

*Note:* consider a short-lived undo toast instead of a confirm dialog for the
human path. Better UX, and it means the agent path is the one place a hard
confirm appears — which is exactly the story we want to tell on video.

### J5 — Rate a book
1–5 stars. Applies to any shelf, though it is most meaningful on Read.

*Note:* allow rating a DNF book. "Two stars, abandoned at page 40" is a
strong taste signal and the profile tool should use it.

### J6 — Import a reading list
Bring in an existing list from Goodreads or similar.

*Note:* Goodreads exports CSV. Full file-upload parsing with column mapping is a
half-day of work for a journey that will get roughly four seconds of video time.
**Scope this to a paste-a-CSV textarea** that reads the three columns that
matter (`Title`, `Author`, `Exclusive Shelf`) and ignores the rest. This is the
first thing to cut if Day 3 runs late — see [06](06-roadmap.md).

## Agent journeys

The three interactions that justify the WebMCP integration.

### A1 — "What should I read next?"
The agent reads the TBR shelf, reads the taste profile built from Read and DNF
history, and recommends with reasoning: *"You rated three Le Guin books 5 stars
and DNF'd two military-SF novels — read The Dispossessed next."*

This is the headline journey. It is also the one that would be genuinely
annoying to do by hand, which is what makes it worth an agent. See
`get_taste_profile` in [04](04-tool-design.md) for why the site computes the
profile rather than the agent.

### A2 — Photograph a shelf → books added
User uploads a photo of a bookshelf or a single cover. The agent identifies the
titles and adds them.

**We build no vision code.** Identification happens agent-side; our tools only
need `search_catalog` (to resolve the identified title to a real record) and
`add_book`. This journey is nearly free given the tools A1 already requires,
which makes it the best value-per-hour item in the whole project.

Design consequence: `add_book` must be safely callable several times in a row,
and the UI must visibly react to each call so the video shows books appearing
one by one.

### A3 — "That book where the anthropologist visits an anarchist moon"
User describes a book they cannot name. The agent web-searches, identifies it,
resolves it via `search_catalog`, and adds it.

Also nearly free. Same two tools as A2. Worth including in the demo because it
shows the agent's own capabilities composing with ours — the site does not need
a semantic search engine, it just needs to be callable.

## Data model

One entity. Keep it small — every field costs output budget when it reaches an
agent.

```ts
type Shelf = 'tbr' | 'read' | 'dnf';

interface Book {
  id: string;              // uuid
  title: string;
  author: string;          // primary author only; OL returns arrays
  year?: number;           // first_publish_year
  coverId?: number;        // OL cover_i → covers.openlibrary.org/b/id/{id}-M.jpg
  olKey?: string;          // "/works/OL59863W" — dedupe key, links back to OL
  shelf: Shelf;
  rating?: 1|2|3|4|5;
  note?: string;           // free text; why it's on the list
  addedAt: string;         // ISO
  updatedAt: string;       // ISO
}
```

Deliberate omissions and why:

- **No ISBN.** Open Library returns ~100 of them per work. Zero value to us,
  enormous output cost.
- **No genre/subject field.** Tempting for the taste profile, but OL subjects are
  noisy and long. Derive taste signals from author and co-occurrence instead —
  see [04](04-tool-design.md).
- **No series field.** The user's brief mentions series search; OL exposes this
  inconsistently. Series terms still work through catalog full-text search, so we
  get the capability without the storage.
- **`author` is a string, not an array.** Take `author_name[0]`. Multi-author
  works are rare enough in a reading list to not be worth the complexity.

## Screens

Three, no router-heavy structure needed:

1. **Shelf** — filter chips, book grid/list, empty state. The default view.
2. **Add** — search field, live results, tap to add. Can be a sheet over Shelf.
3. **Import** — CSV paste box. Can be tucked in a menu.

An **agent activity indicator** is worth building even though no journey demands
it: a small, live "tools available / last call" affordance that lights up when a
tool fires. On video it is the difference between "the list changed somehow" and
"the agent did that, live". Cheap, and it sells the whole submission.

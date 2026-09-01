# 03 — Product Spec

## What TBR is

A personal reading list. Books sit on one of three shelves — **TBR**, **Read**,
**DNF** (did not finish) — and carry an optional 1–5 star rating.

The app has to be genuinely good *without* an agent. "Execution" is a judged
criterion asking for a complete experience, and a demo that is only a tool
harness reads as a prototype. The agent makes the list better; it is not the
only way in.

## Human journeys

### J1 — Add a book
Search by title or author, pick a result, it lands on **TBR**. Search runs
against Open Library, so results arrive with author, first publication year and
cover art attached — the reader types a few characters, not a form.

There is also a manual "add by title" path, for books the catalog lacks or gets
wrong. Cheap to build, and it prevents a dead end on camera.

### J2 — Change shelf
Move a book to **Read** or **DNF**. One tap from the card, no dialog. Moving to
Read is the natural moment to ask for a rating, so the prompt is inline rather
than a separate journey.

### J3 — Browse and filter
The shelf view: filter chips for **TBR / Read / DNF**, each showing a count.
Counts are nearly free and they make the library feel substantial on camera.

### J4 — Remove a book
Permanent, so it needs confirmation. The same dialog serves the reader's own
delete button and the agent's `remove_book` call — exactly one path to
destroying a book, which is easier to reason about and easier to demonstrate.

### J5 — Rate a book
1–5 stars, on any shelf. Rating a DNF is allowed on purpose: "two stars,
abandoned at page 40" is a strong taste signal and the profile uses it.

### J6 — Import a reading list
Goodreads exports CSV. Full file upload with column mapping is half a day of
work for four seconds of video, so this is scoped to a **paste-a-CSV box** that
reads the three columns that matter — `Title`, `Author`, `Exclusive Shelf` —
and ignores the rest.

## Agent journeys

### A1 — "What should I read next?"
The agent reads the taste profile built from Read and DNF history, reads the TBR
shelf, and recommends **with reasoning**: *"You rated three Le Guin books five
stars and gave up on two military-SF novels — read The Dispossessed next."*

The headline journey, and the one that would be genuinely tedious by hand. See
`get_taste_profile` in [04](04-tool-design.md) for why the site computes the
profile rather than the agent.

### A2 — Photograph a shelf, books get added
The reader uploads a photo of a bookshelf. The agent identifies the titles and
adds them.

**There is no vision code in this app.** Identification happens agent-side; the
site only needs `search_catalog` to resolve a title to a real record, and
`add_book`. The journey is nearly free given the tools A1 already requires,
which makes it the best value per hour in the project.

Two design consequences: `add_book` must be safe to call repeatedly, and the UI
must visibly react to each call so books appear one at a time.

### A3 — "That book where the anthropologist visits an anarchist moon"
The reader describes a book they cannot name. The agent web-searches, identifies
it, resolves it through `search_catalog`, adds it. Same two tools as A2.

Worth demonstrating because it shows the agent's own capabilities composing with
the site's: TBR needs no semantic search engine, it just needs to be callable.

### The screen follows the conversation

Cutting across all three: when the agent recommends or discusses a specific
book, the reader should be *looking at it*, not just hearing about it. That is
what `navigate_to` is for, and why most tools end their output by handing off to
it. A recommendation that leaves the reader on a generic shelf is a worse
experience than one that opens the book.

## Data model

One entity. Keep it small — every field costs output budget when it reaches an
agent.

```ts
type Shelf = "tbr" | "read" | "dnf";

interface Book {
  id: string;              // uuid
  title: string;
  author: string;          // primary author only; OL returns arrays
  year?: number;           // first_publish_year
  coverId?: number;        // OL cover_i → covers.openlibrary.org/b/id/{id}-M.jpg
  olKey?: string;          // "/works/OL59863W" — dedupe key, links back to OL
  shelf: Shelf;
  rating?: 1 | 2 | 3 | 4 | 5;
  note?: string;           // free text; why it is on the list
  addedAt: string;         // ISO
  updatedAt: string;       // ISO
}
```

What is deliberately absent:

- **No ISBN.** Open Library returns ~100 per work. No value here, enormous
  output cost.
- **No genre or subject.** Tempting for the taste profile, but OL subjects are
  noisy and long. Taste signals come from author and rating instead.
- **No series field.** OL exposes it inconsistently, and series terms still work
  through full-text catalog search — the capability without the storage.
- **`author` is a string, not an array.** Take `author_name[0]`. Multi-author
  works are rare enough in a reading list to not be worth the complexity.

## Screens

Four routes, all statically exported:

| Route | What it is |
|---|---|
| `/` | The shelf — filter chips, book grid, empty state. The default view. |
| `/search` | Catalog search, add, and the CSV paste box |
| `/taste` | The reading profile, the same data `get_taste_profile` returns |
| `/book?id=` | One book — synopsis, subjects, shelf, rating |

`/book` takes a query parameter rather than a dynamic segment, because a static
export cannot serve `/book/[id]` without enumerating ids at build time and book
ids are runtime values. See [05](05-architecture.md).

The **agent indicator** in the header is worth building even though no journey
demands it: a status dot that opens a popover listing the live tools, plus
toasts and a pulse on any book a tool changed. On video it is the difference
between "the list changed somehow" and "the agent did that, live".

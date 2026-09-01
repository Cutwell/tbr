# 03 — Product Spec

## Scope

TBR is a personal reading list. Each book occupies one of three shelves (TBR,
Read, DNF) and carries an optional rating from one to five stars.

The application must be complete without an agent. "Execution" is a judged
criterion requiring a working product with a complete experience, and an
interface that exists only to host tools does not satisfy it. Agent support
extends the product rather than constituting it.

## Human journeys

### J1 — Add a book

The reader searches by title or author, selects a result, and the book lands on
the TBR shelf. Search queries Open Library, so results carry author, first
publication year and cover art without further input.

A manual "add by title" path covers books the catalogue lacks or misidentifies.
It is inexpensive to build and prevents a dead end during a live demonstration.

### J2 — Change shelf

Move a book to Read or DNF from the card, without a dialog. Moving to Read is
the natural point at which to request a rating, so that prompt appears inline
rather than as a separate journey.

### J3 — Browse and filter

The shelf view provides filter chips for TBR, Read and DNF, each displaying a
count. Counts cost little and convey the size of the library at a glance.

### J4 — Remove a book

Removal is permanent and requires confirmation. One dialog serves both the
reader's own delete control and the agent's `remove_book` call, giving a single
path to destroying a book.

### J5 — Rate a book

One to five stars, available on any shelf. Rating a DNF book is permitted
deliberately: a low rating attached to an abandoned book is a strong taste
signal, and the profile uses it.

### J6 — Import a reading list

Goodreads exports CSV. File upload with column mapping represents roughly half a
day of work for a journey that occupies a few seconds of demonstration, so the
scope is a paste-a-CSV field reading the relevant columns (`Title`, `Author`,
`Exclusive Shelf`, `My Rating`, `Date Read`) and ignoring the rest. `Date Read`
is parsed in both formats Goodreads exports and falls back to today only when it
is blank or unreadable — stamping today across a 200-book import would claim the
reader finished their whole history that afternoon.

## Agent journeys

### A1 — "What should I read next?"

The agent reads the taste profile derived from Read and DNF history, reads the
TBR shelf, and recommends with reasoning: *"You rated three Le Guin books five
stars and abandoned two military-SF novels, so The Dispossessed is a good
match."*

This is the primary journey and the one that is most tedious to perform
manually. [04-tool-design.md](04-tool-design.md) covers why the site computes
the profile rather than the agent.

### A2 — Photographed shelf

The reader uploads a photograph of a bookshelf. The agent identifies the titles
and adds them.

The application contains no vision code. Identification happens agent-side, and
the site supplies only `search_catalog` to resolve a title to a catalogue
record and `add_book` to file it. The journey requires no tools beyond those A1
already needs, which makes it the highest-value addition per hour of work in the
project.

Two design consequences follow: `add_book` must be safe to call repeatedly, and
the interface must react visibly to each call so that books appear individually
rather than in a single batch.

### A3 — Book identified from description

The reader describes a book without naming it. The agent web-searches,
identifies it, resolves it through `search_catalog`, and adds it. The tool
requirements are identical to A2.

The journey demonstrates the agent's own capabilities composing with the site's:
TBR requires no semantic search of its own, only a callable interface.

### Cross-cutting: on-screen state follows the conversation

When the agent recommends or discusses a specific book, the reader should be
viewing that book rather than only hearing its name. This is the purpose of
`navigate_to`, and the reason most tools conclude their output by handing off to
it. Without it, the agent's reply and the visible state diverge.

## Data model

A single entity. Field count is constrained because every field consumes output
budget when it reaches an agent.

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
  note?: string;           // free text; why the book is on the list
  endedAt?: string;        // "YYYY-MM-DD" — the day it was finished or abandoned
  addedAt: string;         // ISO instant
  updatedAt: string;       // ISO instant
}
```

`endedAt` is the one field that is a calendar date rather than an instant, and
the distinction is deliberate. `addedAt` and `updatedAt` record when the
software did something; `endedAt` records a day a person picked, and can be
edited on the book page. Storing it as a timestamp would mean "12 March" chosen
in UTC+13 comes back as 11 March once normalised through UTC — verified: under
`America/Los_Angeles`, `new Date("2019-01-01")` formats as *31 December 2018*.
There is no hour of the day worth keeping to justify that. It is also the format
`<input type="date">` reads and writes, and the one Goodreads exports.

One field covers both shelves because it records the same event either way, and
the shelf already says which it was — the UI reads it as "Finished" on `read`
and "Gave up" on `dnf`. It is absent on `tbr`, and cleared when a book moves
back there: a book you intend to read has not ended.

Omissions and their rationale:

- **No ISBN.** Open Library returns approximately 100 per work, at high output
  cost and no benefit to any journey.
- **No genre or subject.** Open Library subjects are long and noisy. Taste
  signals derive from author and rating instead.
- **No series field.** Open Library exposes series inconsistently, and series
  terms remain searchable through full-text catalogue search, providing the
  capability without the storage.
- **`author` is a string rather than an array.** The value is `author_name[0]`.
  Multi-author works are rare in a reading list and do not justify the added
  complexity.
- **No start date, only an end date.** "When did you finish it" is answerable
  from memory; "when did you start" usually is not, and a field readers cannot
  fill honestly is worse than no field. `endedAt` is also the one the shelf
  already implies a value for, which is what makes automatic stamping safe.

## Screens

Four routes, all statically exported.

| Route | Contents |
|---|---|
| `/` | The shelf: filter chips, book grid, and — on an empty library — the first-run panel. The default view. |
| `/search` | Catalogue search, add, and the CSV paste field |
| `/taste` | The reading profile, over the same data `get_taste_profile` returns |
| `/book?id=` | A single book: synopsis, subjects, shelf, rating, and the finished/gave-up date |

`/book` accepts a query parameter rather than a dynamic segment because a static
export cannot serve `/book/[id]` without enumerating ids at build time, and book
ids are runtime values. See [05-architecture.md](05-architecture.md).

The agent indicator in the header is not required by any journey but is retained
deliberately: a status dot opening a popover that lists the live tools, together
with toasts and a highlight on any book a tool has changed. It distinguishes a
change the agent caused from a change of unclear origin.

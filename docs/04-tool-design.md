# 04 — WebMCP Tool Design

Eight tools. Each maps to a journey in [03](03-product-spec.md); none is a
generic CRUD wrapper.

Chrome's guidance is deliberately anti-prescriptive about tool count — design
from the user goal, not a target number. Eight is defensible because each earns
a journey, and beyond roughly ten an agent's tool-selection accuracy starts to
degrade, so this is close to the ceiling.

| # | Tool | Mutates | Annotations | Journey |
|---|---|---|---|---|
| 1 | `search_catalog` | no | `readOnlyHint`, **`untrustedContentHint`** | A2, A3, J1 |
| 2 | `search_my_books` | no | `readOnlyHint` | A1, J3 |
| 3 | `get_taste_profile` | no | `readOnlyHint` | **A1** |
| 4 | `add_book` | yes | — | A2, A3, J1 |
| 5 | `update_book` | yes | — | J2, J5 |
| 6 | `remove_book` | **destructive** | `destructiveHint` + `requestUserInteraction` | J4 |
| 7 | `import_books` | yes, in bulk | — | J6 |
| 8 | `navigate_to` | view only | `readOnlyHint` | all three |

Implementation: [`src/lib/webmcp/tools.ts`](../src/lib/webmcp/tools.ts). Names are
all ≤30 characters; `auditToolDescriptors()` asserts every character budget at
start-up in development, so an over-long description fails loudly rather than
degrading agent behaviour invisibly.

---

## The output budget is the design

Every tool shares a **1,500-character** ceiling ([02](02-webmcp-reference.md)).
Two rules follow, and they shape every schema below.

### Rule 1 — Delimited rows, not JSON

JSON repeats every key on every row, which matters at list sizes:

```
JSON   {"id":"a3f1","title":"The Dispossessed","author":"Ursula K. Le Guin","shelf":"tbr","rating":4}   ~95 chars
Pipe   a3f1 | The Dispossessed | Ursula K. Le Guin | tbr | 4                                            ~48 chars
```

Roughly **twice as many books per call**. Emit the header once, then rows:

```
id | title | author | shelf | rating
a3f1 | The Dispossessed | Ursula K. Le Guin | tbr | -
b7c2 | Piranesi | Susanna Clarke | read | 5
```

Where a host also accepts `structuredContent`, the JSON goes there as well — it
does not count against the text the agent reads.

### Rule 2 — Cap results, and say you capped them

Default `limit` of 10, hard maximum 20, and always say what was withheld:

```
Showing 10 of 47 matches. Narrow with `query` or `status` to see others.
```

Truncating silently is the failure mode that makes an agent confidently wrong.

---

## 1. `search_catalog`

Full-text Open Library search across title, author, series and year, so one
parameter covers every attribute a reader might use.

```js
inputSchema: {
  type: "object",
  properties: {
    query: { type: "string",
      description: 'Free text: title, author, series or year. e.g. "le guin dispossessed"' },
    limit: { type: "integer", minimum: 1, maximum: 20,
      description: "Maximum results to return. Defaults to 10." },
  },
  required: ["query"],
  additionalProperties: false,
},
annotations: { readOnlyHint: true, untrustedContentHint: true }
```

**Why `untrustedContentHint`.** Open Library is a public wiki — anyone can edit a
record, and titles and author names flow straight into the agent's context. That
makes this an indirect prompt-injection surface, and flagging it is a real
mitigation rather than a formality.

**Field projection at the API call**, so the 100-element ISBN array never crosses
the wire:

```
https://openlibrary.org/search.json
  ?q={query}&limit={limit}
  &fields=key,title,author_name,first_publish_year,cover_i
```

The `/works/` prefix is stripped from `key` for compactness (`OL59863W`).

**Known weakness:** Open Library's relevance ranking is mediocre — searching
"the dispossessed" returns *The Lathe of Heaven* second. Not fixable from here.
Mitigated by returning year and author on every row so the agent can pick
correctly, and by keeping `limit` generous enough to contain the right answer.

```
Catalog matches for "le guin dispossessed":
id | title | author | year
OL59863W | The Dispossessed | Ursula K. Le Guin | 1974
OL59858W | The Lathe of Heaven | Ursula K. Le Guin | 1971
Pass an id to add_book.
```

---

## 2. `search_my_books`

The reader's own shelves, with optional filters for shelf, text and minimum
rating. All optional — an agent asking "what's on my list" should not have to
guess required parameters.

**An empty result has to be actionable**, per Chrome's guidance that a failed
call should act as a guide rather than a dead end:

```
No books on your TBR shelf match "tolkien". You have 24 TBR books in total.
```

That second sentence tells the agent its filter was wrong rather than the shelf
being empty — a distinction it cannot otherwise make.

---

## 3. `get_taste_profile` ⭐

**The centrepiece.**

The problem: A1 ("what should I read next?") needs the agent to understand taste
across the whole Read and DNF history. Within 1,500 characters it cannot page
through 80 books to work that out — it would take a dozen calls and still not
fit.

The solution: **the site aggregates and hands over a compact profile.** This is
the argument for WebMCP over screen-scraping — the site knows its own data and
can pre-compute exactly the summary the agent needs, in a fraction of the
tokens.

```
READING PROFILE
Shelves: 24 TBR, 47 read, 9 DNF. Average rating 3.6 (53 rated).

Loved (4-5★): Ursula K. Le Guin (4 books, avg 4.8), Susanna Clarke (2, 5.0),
  Gene Wolfe (3, 4.3)
Disliked (1-2★ or DNF): Neal Stephenson (2 DNF), Brandon Sanderson (1★)
Eras: 1970s 31%, 2010s 24%, 1960s 15%
Finishing rate: 84% (9 of 56 started were abandoned)
Recently finished: Piranesi (5★), Ancillary Justice (4★), Babel (3★)

Signal: Has given up on Neal Stephenson more than once.
```

That **Signal** line is computed with deterministic heuristics — mean rating by
decade, DNF clustering by author — not an LLM call. It gives the agent a
hypothesis to reason from rather than raw counts to interpret.

**The cold-start case is guarded.** A brand-new reader has no history, and an
empty profile makes the agent hallucinate a taste. It answers honestly instead:

```
Not enough history yet — 3 books read, none rated. Recommend from the TBR shelf
directly and ask the reader what they're in the mood for.
```

---

## 4. `add_book`

Two paths on purpose: `catalog_id` from `search_catalog` gives a rich record with
cover art; `title` + `author` is the fallback when the catalog fails, which is a
real occurrence given the ranking above. Requiring `catalog_id` would strand
A2 and A3 whenever the agent identifies a book the catalog ranks badly.

Validation fails *instructively*:

```
Need either catalog_id, or title and author. Call search_catalog first to get a
catalog_id.
```

**Deduplicates on `olKey`, and treats a repeat as success** rather than an error.
The photo journey re-adds books constantly, and an error there derails the
agent:

```
"The Dispossessed" is already on your TBR shelf (added 12 Aug). No change made.
```

---

## 5. `update_book`

Shelf changes and ratings in one tool. Splitting it into `set_status` and
`rate_book` would be more granular than the reader's actual intent — "I finished
it, four stars" is one thought.

An omitted field means unchanged, and every parameter description says so, or
the agent will null out fields it never meant to touch. An unknown `book_id`
guides rather than dead-ends:

```
No book with id "xyz". Call search_my_books to get current ids.
```

---

## 6. `remove_book` — the human-in-the-loop showcase

Permanent deletion: the only genuinely destructive tool, and the best available
demonstration of agent–human collaboration.

```js
const confirmed = await agent?.requestUserInteraction?.(async () =>
  showConfirmDialog(`Remove "${book.title}" from your list?`)
);

if (confirmed === false) {
  return err(`Reader declined. "${book.title}" was not removed.`);
}
```

Note the optional chaining and the explicit `=== false`. If
`requestUserInteraction` is unavailable, `confirmed` is `undefined` and the call
proceeds through the app's own dialog — a hard requirement would make the tool
fail entirely on hosts that lack it.

The dialog is the same one the app's own delete button opens. There is exactly
one path to destroying a book, whoever asked for it.

This is worth twenty seconds of video: the agent proposes a deletion, the app
asks the human, the human says **no**, and the agent reports back that it was
declined. That is precisely "humans and agents working together".

---

## 7. `import_books`

Takes Goodreads-style CSV text and maps its shelves: `to-read` → `tbr`,
`read` → `read`, anything else → `tbr`. It shares its parser with the UI's paste
box, so there is one CSV implementation rather than two.

**Output budget matters most here** — a 200-book import cannot list what it
imported, so it returns a summary:

```
Imported 143 books: 98 to TBR, 45 to read. Skipped 7 duplicates and 2 rows with
no title.
```

---

## 8. `navigate_to`

Changes what the reader is looking at, and nothing else. `view` is one of
`shelf`, `book`, `taste` or `search`, with an optional `book_id`, `shelf` filter
or pre-filled `query`.

It exists because a recommendation the reader only *hears* is a worse
experience than one they can see. Without it, the agent's answer and the screen
drift apart: the model names a book while the reader is looking at a generic
shelf, and the app's whole visual argument — the state follows the
conversation — is lost.

It carries `readOnlyHint` because it touches no data. Changing the view is not a
mutation, and an agent should not have to hesitate over it.

Which destination is most useful varies, so tools choose rather than always
returning to the same route:

| After | Opens |
|---|---|
| `search_catalog` | The catalogue results — useful when discussing several books |
| `search_my_books`, one match | That book |
| `add_book` | The book's shelf, with the new card highlighted |
| `update_book` | The changed book |
| `remove_book`, `import_books` | The shelf — there is no single surviving book to show |
| `get_taste_profile` | Nothing. It is decision context, not a book |

---

## Steering the agent — three channels

**WebMCP has no prompts primitive.** `provideContext()` accepts `{ tools }` and
nothing else; the proposal lists MCP's `resources` and `prompts` as alignment
goals, not current features. There is no system prompt, no page-level
instruction field, no way to hand an agent a workflow.

So all steering happens through three surfaces the site already owns.

### 1. Descriptions carry preconditions, not just capability

A description that says only what a tool *does* leaves ordering to chance. Each
one names the step before or after it:

> `get_taste_profile` — "…Call this **FIRST** whenever the reader asks what to
> read next, what they would like, or anything about their reading habits —
> before searching their shelves…"

> `search_my_books` — "…When a named-book search identifies what the reader is
> discussing, follow it with `navigate_to` so that book is on screen."

The cross-references are deliberate and reciprocal: `search_my_books` points back
at `get_taste_profile` for recommendation questions, and `search_catalog` insists
on being called before `add_book` so books arrive with cover art. All still fit
the 500-character budget.

### 2. Output chains to the next step

The stronger channel, because it costs no description budget and arrives exactly
when it is relevant. `get_taste_profile` ends with:

```
Next: call search_my_books with status=tbr, choose ONE book from that shelf,
then call navigate_to with view=book and its book_id BEFORE replying. Say
briefly why it fits this profile.
```

That is the whole flagship journey, handed over at the one moment the agent is
guaranteed to be paying attention.

Guidance is **conditional**, not blanket. `search_my_books` appends a
recommendation hint only when listing the *whole* `tbr` shelf — the shape of a
"what next?" question — and stays silent on a filtered search, which is usually
part of some other task. Unconditional advice trains an agent to ignore it.

Measured cost: the taste profile grew from 606 to **732 characters** when the
navigation handoff was added, and a full TBR listing is **451**. Both are far
inside the 1,500 budget.

### 3. The page itself

An agent reads the DOM — that is exactly what ChatGPT falls back to when tools
are not discovered. So the agent popover names the journeys in the reader's own
words:

> "What should I read next?" · "Here's a photo of my shelf — add these to my
> list" · "I finished Piranesi, five stars"

This is the only channel that is also real UI: it orients an agent *and* tells a
first-time reader what the app is for.

### One caution

Guidance in tool output travels the same channel as data from `search_catalog`,
which is flagged untrusted because Open Library is publicly editable. Ours is
authored and safe; the rule that keeps it that way is that **no guidance line
may ever interpolate catalogue text**. Keep next-step strings literal, or a wiki
edit becomes an instruction to the agent.

---

## Cross-cutting decisions

**Register once, never re-register.** `provideContext` replaces the whole toolset
while `registerTool` is additive, so any state-dependent toolset would have to
be correct under both semantics. Exposing `import_books` only on the import
screen would buy nothing and cost a category of bug.

**Every error names the next tool to call.** Chrome's guidance is that responses
should "act as a guide rather than a dead end", and never return generic errors,
raw API errors, or fail silently. It is cheap to honour and it is exactly what
the WebMCP Leverage criterion rewards.

**Budgets are asserted, not remembered.** 500 characters per description, 150 per
parameter, 1,500 per output. `auditToolDescriptors()` checks the first two at
start-up; `withinBudget()` enforces the third by truncating at a row boundary
with an explicit marker, because a table cut mid-row is worse than a short one.

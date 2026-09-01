# 04 — WebMCP Tool Design

Seven tools. The brief proposed four; the three additions
(`remove_book`, `get_taste_profile`, `import_books`) each unlock a stated user
journey that the original four cannot serve.

Chrome's guidance is deliberately anti-prescriptive about tool count — design
from the user goal, not a target number. Seven is defensible here because each
maps to a journey in [03](03-product-spec.md). Going much beyond ~10 starts to
degrade the agent's tool-selection accuracy, so this is close to the ceiling.

| # | Tool | Mutates? | Annotations | Journey |
|---|---|---|---|---|
| 1 | `search_catalog` | no | `readOnlyHint`, **`untrustedContentHint`** | A2, A3, J1 |
| 2 | `search_my_books` | no | `readOnlyHint` | A1, J3 |
| 3 | `get_taste_profile` | no | `readOnlyHint` | **A1** |
| 4 | `add_book` | yes | — | A2, A3, J1 |
| 5 | `update_book` | yes | — | J2, J5 |
| 6 | `remove_book` | **destructive** | — + `requestUserInteraction` | J4 |
| 7 | `import_books` | yes (bulk) | — | J6 |

Names are all ≤30 characters. Verify with a lint check before shipping.

---

## The output budget is the design

Every tool shares a **1,500 character** output ceiling
([02](02-webmcp-reference.md)). Two rules follow, and they drive every schema
below.

### Rule 1 — Delimited rows, not JSON

JSON repeats every key on every row. At list sizes that matters:

```
JSON   {"id":"a3f1","title":"The Dispossessed","author":"Ursula K. Le Guin","shelf":"tbr","rating":4}   ~95 chars
Pipe   a3f1 | The Dispossessed | Ursula K. Le Guin | tbr | 4                                            ~48 chars
```

Roughly **2× more books per call**. Emit a header line once, then rows:

```
id | title | author | shelf | rating
a3f1 | The Dispossessed | Ursula K. Le Guin | tbr | -
b7c2 | Piranesi | Susanna Clarke | read | 5
```

Where a host also accepts `structuredContent`, send the JSON there as well —
belt and braces, and it does not count against the text the agent reads.

### Rule 2 — Cap results, and say you capped them

Default `limit: 10`, hard maximum 20. Always tell the agent what it did not see,
so it can narrow rather than assume it has everything:

```
Showing 10 of 47 matches. Narrow with `query` or `status` to see others.
```

Truncating silently is the failure mode that makes an agent confidently wrong.

---

## 1. `search_catalog`

Search Open Library. Full-text across title, author, series, and year, so one
parameter covers every attribute in the brief.

```js
{
  name: 'search_catalog',
  description:
    'Search the global book catalog (Open Library) for real books by title, ' +
    'author, series, or year. Returns candidate matches with an id to pass to ' +
    'add_book. Use this to resolve a book you have identified from a photo or ' +
    'description before adding it. Does not read or change the user\'s list.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string',
        description: 'Free text: title, author, series or year. e.g. "le guin dispossessed"' },
      limit: { type: 'integer', minimum: 1, maximum: 20, default: 10,
        description: 'Max results to return. Defaults to 10.' }
    },
    required: ['query'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true }
}
```

**Why `untrustedContentHint: true`.** Open Library is a public wiki — anyone can
edit a record. Titles and author names flow straight into the agent's context,
which makes this an indirect prompt-injection surface. Flagging it is a real
mitigation, not a formality, and it is worth naming in the submission text.

**Implementation.** Project fields server-side via the `fields` parameter so the
100-element ISBN array never crosses the wire:

```
https://openlibrary.org/search.json
  ?q={query}&limit={limit}
  &fields=key,title,author_name,first_publish_year,cover_i
```

Verified: `access-control-allow-origin: *`, no API key. Strip the `/works/`
prefix from `key` for compactness (`OL59863W`).

**Known weakness:** OL relevance ranking is mediocre — a search for
"the dispossessed" returns *The Lathe of Heaven* second. Not fixable by us.
Mitigate by returning the year and author on every row so the agent can pick
correctly, and by keeping `limit` generous enough to contain the right answer.

**Output**

```
Catalog matches for "le guin dispossessed":
id | title | author | year
OL59863W | The Dispossessed | Ursula K. Le Guin | 1974
OL59858W | The Lathe of Heaven | Ursula K. Le Guin | 1971
Pass an id to add_book.
```

---

## 2. `search_my_books`

The user's own shelves, with filters.

```js
inputSchema: {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['tbr','read','dnf'],
      description: 'Shelf to search. Omit to search all shelves.' },
    query:  { type: 'string',
      description: 'Optional title or author substring filter.' },
    min_rating: { type: 'integer', minimum: 1, maximum: 5,
      description: 'Only books rated at least this many stars.' },
    limit: { type: 'integer', minimum: 1, maximum: 20, default: 10,
      description: 'Max results. Defaults to 10.' }
  },
  required: [],
  additionalProperties: false
},
annotations: { readOnlyHint: true }
```

All filters optional — an agent asking "what's on my list" should not have to
guess required parameters.

**Empty result must be actionable**, per Chrome's error guidance ("a guide
rather than a dead end"):

```
No books on your TBR shelf match "tolkien". You have 24 TBR books in total.
```

That second sentence tells the agent its filter was wrong rather than the
shelf being empty — a distinction it cannot otherwise make.

---

## 3. `get_taste_profile` ⭐

**The centrepiece of the submission.**

The problem: journey A1 ("what should I read next?") needs the agent to
understand taste across the whole Read and DNF history. With a 1,500-character
budget, an agent cannot page through 200 books to work that out — it would take
a dozen calls and still not fit.

The solution: **the site does the aggregation and hands over a compact profile.**
This is the argument for WebMCP over screen-scraping or a generic browser agent —
the site knows its own data and can pre-compute exactly the summary the agent
needs, in a fraction of the tokens.

```js
{
  name: 'get_taste_profile',
  description:
    'Get a compact summary of the reader\'s taste, computed from their rating ' +
    'and reading history: favourite authors, abandoned authors, rating ' +
    'patterns, era preferences and shelf sizes. Call this before recommending ' +
    'a book so suggestions match what they actually enjoy.',
  inputSchema: { type: 'object', properties: {}, required: [],
                 additionalProperties: false },
  annotations: { readOnlyHint: true }
}
```

**Output** (target ≤900 chars, leaving headroom):

```
READING PROFILE
Shelves: 24 TBR, 61 read, 9 DNF. Average rating 3.6 (48 rated).

Loved (4-5★): Ursula K. Le Guin (4 books, avg 4.8), Susanna Clarke (2, 5.0),
  Gene Wolfe (3, 4.3)
Disliked (1-2★ or DNF): Neal Stephenson (2 DNF), Brandon Sanderson (1★)
Eras: 1970s 31%, 2010s 24%, 1960s 15%
Finishing rate: 87% (9 of 70 started were abandoned)
Recently finished: Piranesi (5★), Ancillary Justice (4★), Babel (3★)

Signal: rates literary and older speculative fiction highly; abandons long
door-stopper series.
```

That last **Signal** line is computed by us with simple heuristics (compare mean
rating by decade, by page-count band where known, DNF clustering). It is not an
LLM call — deterministic rules, and it gives the agent a hypothesis to reason
from rather than raw counts.

**Guard the cold-start case.** A brand-new user has no history, and returning an
empty profile makes the agent hallucinate a taste. Return honestly:

```
Not enough history yet — 3 books read, none rated. Recommend from the TBR shelf
directly and ask the reader what they're in the mood for.
```

---

## 4. `add_book`

```js
inputSchema: {
  type: 'object',
  properties: {
    catalog_id: { type: 'string',
      description: 'Open Library id from search_catalog, e.g. "OL59863W". Preferred.' },
    title:  { type: 'string', description: 'Book title. Use if no catalog_id.' },
    author: { type: 'string', description: 'Author name. Use if no catalog_id.' },
    status: { type: 'string', enum: ['tbr','read','dnf'], default: 'tbr',
      description: 'Shelf to add to. Defaults to tbr.' },
    note:   { type: 'string', description: 'Optional short note on why it was added.' }
  },
  required: [],
  additionalProperties: false
}
```

Two paths on purpose: `catalog_id` gives a rich record with cover art;
`title`+`author` is the fallback when the catalog fails (a real occurrence given
OL's ranking). Requiring `catalog_id` would strand journeys A2/A3 whenever the
agent identifies a book the catalog ranks badly.

Validate that at least one path is satisfied, and fail *instructively*:

```
Need either catalog_id, or title and author. Call search_catalog first to get a
catalog_id.
```

**Deduplicate on `olKey`**, and treat a repeat as success rather than an error —
the photo journey (A2) will re-add books, and an error there derails the agent:

```
"The Dispossessed" is already on your TBR shelf (added 12 Aug). No change made.
```

**UI coupling:** every successful call must visibly update the list. This is what
makes the video work.

---

## 5. `update_book`

Shelf changes and ratings in one tool. Two separate tools (`set_status`,
`rate_book`) would be more granular than the user goal warrants — "I finished it,
give it 4 stars" is one intent.

```js
inputSchema: {
  type: 'object',
  properties: {
    book_id: { type: 'string',
      description: 'Id from search_my_books. Required.' },
    status:  { type: 'string', enum: ['tbr','read','dnf'],
      description: 'New shelf. Omit to leave unchanged.' },
    rating:  { type: 'integer', minimum: 1, maximum: 5,
      description: 'Star rating 1-5. Omit to leave unchanged.' },
    note:    { type: 'string', description: 'Replace the note. Omit to leave unchanged.' }
  },
  required: ['book_id'],
  additionalProperties: false
}
```

Omitted field = unchanged. State this in every parameter description or the
agent will null out fields it did not intend to touch.

Unknown `book_id` — guide, do not dead-end:

```
No book with id "xyz". Call search_my_books to get current ids.
```

---

## 6. `remove_book` — the human-in-the-loop showcase

Permanent deletion. The only genuinely destructive tool, and the best
demonstration of agent/human collaboration available to us.

```js
execute: async ({ book_id }, agent) => {
  const book = store.get(book_id);
  if (!book) return err(`No book with id "${book_id}". Call search_my_books for current ids.`);

  const confirmed = await agent?.requestUserInteraction?.(async () =>
    showConfirmDialog(`Remove "${book.title}" from your list?`)
  );

  if (confirmed === false) {
    return err(`Reader declined. "${book.title}" was not removed.`);
  }
  store.remove(book_id);
  return ok(`Removed "${book.title}".`);
}
```

Note the optional chaining and the explicit `=== false` test. If
`requestUserInteraction` is unavailable in the host, `confirmed` is `undefined`
and we proceed — a hard requirement would make the tool fail entirely on hosts
that lack it. **Verify which hosts support it during the Day 1 spike**
([06](06-roadmap.md)); if ChatGPT's browser lacks it, fall back to our own modal
and say so on video.

This is worth 20 seconds of the demo: the agent proposes a deletion, the app
asks the human, the human says no, and the agent reports back that it was
declined. That is precisely "humans and agents working together".

---

## 7. `import_books`

```js
inputSchema: {
  type: 'object',
  properties: {
    csv: { type: 'string',
      description: 'Goodreads-style CSV text with Title, Author, Exclusive Shelf columns.' }
  },
  required: ['csv'],
  additionalProperties: false
}
```

Maps Goodreads shelves: `to-read`→`tbr`, `read`→`read`, anything else→`tbr`.

**Output budget matters here more than anywhere** — a 200-book import cannot
list what it imported. Return a summary only:

```
Imported 143 books: 98 to TBR, 45 to read. Skipped 7 duplicates and 2 rows with
no title.
```

**Lowest-value tool in the set** and the first cut if the schedule slips.
Consider making import human-only (paste box in the UI, no tool) — the journey
is still demonstrated, and it saves a tool's worth of schema, testing and
description budget.

---

## Steering the agent — the three channels

**WebMCP has no prompts primitive.** `provideContext()` accepts `{ tools }` and
nothing else; the proposal notes MCP's `resources` and `prompts` as alignment
goals, not current features, and ChatGPT supports a subset of even the tool API.
There is no system prompt, no page-level instruction field, no way to hand an
agent a workflow.

So all steering happens through three surfaces we already own. Used together
they cover the happy paths without inventing anything.

### 1. Descriptions carry preconditions, not just capability

A description that says only what a tool *does* leaves ordering to chance.
Each one now names the step before or after it:

> `get_taste_profile` — "…Call this **FIRST** whenever the reader asks what to
> read next, what they would like, or anything about their reading habits —
> before searching their shelves…"

> `update_book` — "…When the reader says they finished a book or gave up on
> one, call `search_my_books` to find its `book_id`, then set the shelf and the
> rating here in a single call."

Cross-references are deliberate and reciprocal: `search_my_books` points back at
`get_taste_profile` for recommendation questions, and `search_catalog` insists on
being called before `add_book` so books arrive with cover art. All still fit the
500-character budget — the dev-time audit fails the console if one does not.

### 2. Output chains to the next step

The stronger channel, because it costs no description budget and arrives exactly
when it is relevant. `get_taste_profile` ends with:

```
Next: call search_my_books with status=tbr, choose ONE book from that shelf,
then call `navigate_to` with `view: "book"` and its `book_id` before replying.
Say briefly why it fits this profile.
```

That is the whole flagship journey, handed over at the only moment the agent is
guaranteed to be paying attention to it.

Guidance is **conditional**, not blanket. `search_my_books` appends a
recommendation hint only when listing the *whole* `tbr` shelf — the shape of a
"what next?" question — and stays silent on a filtered search, which is usually
part of some other task. The handoff explicitly makes `navigate_to` the final
tool call before the response, so a recommendation leaves the reader looking at
the chosen book instead of merely naming it. Unconditional advice trains an
agent to ignore it.

The same principle applies to a book the reader names directly. A one-result
`search_my_books` response instructs the agent to navigate to that book even if
no state change is needed; successful `update_book` calls navigate there
themselves. This makes the on-screen state follow the conversation rather than
only showing mutations on a generic shelf.

Tools choose the most useful destination rather than always returning to the
same route: a catalogue search opens its query results for author, series, and
multi-book discussions; an update opens the changed book; an added book opens
its filtered shelf and highlights the new card; and removal or bulk import
returns to the shelf because there is no single surviving book to inspect. The
taste profile remains non-navigating because it is decision context, not a
specific book or set of books to show.

Costs measured: profile 606 → **732 chars**, tbr listing **451**. Both far
inside the 1,500 budget.

### 3. The page itself

An agent reads the DOM — that is precisely what ChatGPT falls back to when tools
are not discovered. So the agent panel names the journeys in the reader's own
words:

> "What should I read next?" · "Here's a photo of my shelf — add these to my
> list" · "I finished Piranesi, five stars"

This is the only channel that is also real UI: it orients an agent *and* tells a
first-time reader what the app is for.

### One caution

Guidance in tool output travels the same channel as data from
`search_catalog`, which is flagged `untrustedContentHint` because Open Library
is publicly editable. Our instructions are authored by us and safe; the rule is
that **no guidance line may ever interpolate catalogue text**, or a wiki edit
becomes an instruction to the agent. Keep next-step strings literal.

---

## Cross-cutting decisions

### Re-registration on state change
`provideContext` replaces the whole toolset; `registerTool` is additive. If we
ever re-register (e.g. exposing `import_books` only on the import screen), the
adapter in [02](02-webmcp-reference.md) must handle both semantics or the
`registerTool` path will silently duplicate tools.

**Recommendation: register all seven once, at app start, and never re-register.**
State-dependent tool sets are a nice-to-have that buys us nothing on video and
introduces a whole class of bug three days before a deadline.

### Error style
Chrome's guidance: responses should "act as a guide rather than a dead end", and
never return generic errors, raw API errors, or fail silently. Every error path
above names the next tool to call. Hold to that — it is cheap and it is exactly
what the "WebMCP Leverage" criterion rewards.

### Description budget
500 chars per tool description, 150 per parameter. The `search_catalog`
description above is ~290. Add a build-time assertion over the tool table so an
over-long description fails the build rather than degrading agent behaviour
invisibly.

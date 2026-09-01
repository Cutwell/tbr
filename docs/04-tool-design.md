# 04 — WebMCP Tool Design

The toolset comprises seven tools, each mapped to a journey in
[03-product-spec.md](03-product-spec.md).

Chrome's guidance is deliberately non-prescriptive about tool count, directing
designers to work from user goals rather than a target number. Seven is
defensible on that basis. Tool-selection accuracy degrades beyond roughly ten,
which leaves headroom rather than crowding the ceiling.

| # | Tool | Mutates | Annotations | Journey |
|---|---|---|---|---|
| 1 | `search_catalog` | no | `readOnlyHint`, `untrustedContentHint` | A2, A3, J1 |
| 2 | `search_my_books` | no | `readOnlyHint` | A1, J3 |
| 3 | `get_taste_profile` | no | `readOnlyHint` | A1 |
| 4 | `add_book` | yes | — | A2, A3, J1 |
| 5 | `update_book` | yes | — | J2, J5 |
| 6 | `remove_book` | destructive | `destructiveHint`, `requestUserInteraction` | J4 |
| 7 | `navigate_to` | view only | `readOnlyHint` | A1, A2, A3 |

An eighth, `import_books`, was built and then withdrawn after a host security
review rejected the call. J6 is served by the UI paste field alone and is
unaffected. The diagnosis is [07-risks.md](07-risks.md) R11; the reasoning it
produced about annotation defaults applies to tools 4 and 5 and is recorded
under [Annotation defaults](#annotation-defaults) below.

The implementation is [`src/lib/webmcp/tools.ts`](../src/lib/webmcp/tools.ts).
All names are 30 characters or fewer. `auditToolDescriptors()` asserts every
character budget at start-up in development, so an over-long description fails
loudly rather than degrading agent behaviour silently.

---

## The output budget as a design constraint

Every tool shares a 1,500-character ceiling
([02-webmcp-reference.md](02-webmcp-reference.md)). Two rules follow, and they
shape every schema below.

### Rule 1 — Delimited rows rather than JSON

JSON repeats each key on each row, which is significant at list sizes.

```
JSON   {"id":"a3f1","title":"The Dispossessed","author":"Ursula K. Le Guin","shelf":"tbr","rating":4}   ~95 chars
Pipe   a3f1 | The Dispossessed | Ursula K. Le Guin | tbr | 4                                            ~48 chars
```

The delimited form carries roughly twice as many books per call. The header is
emitted once, followed by rows.

```
id | title | author | shelf | rating
a3f1 | The Dispossessed | Ursula K. Le Guin | tbr | -
b7c2 | Piranesi | Susanna Clarke | read | 5
```

Where a host also accepts `structuredContent`, the JSON is supplied there as
well, since it does not count against the text the agent reads.

### Rule 2 — Cap results and report the cap

`limit` defaults to 10 with a hard maximum of 20. Output states what was
withheld.

```
Showing 10 of 47 matches. Narrow with `query` or `status` to see others.
```

Silent truncation is the failure mode that produces confidently wrong agent
behaviour, because the agent has no way to detect that data is missing.

---

## 1. `search_catalog`

Full-text Open Library search across title, author, series and year. A single
parameter therefore covers every attribute a reader is likely to supply.

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

### Why `untrustedContentHint`

Open Library is a public wiki and any record is editable by anyone. Titles and
author names flow directly into the agent's context, which makes this tool an
indirect prompt-injection surface. The annotation reflects a real property of
the data source.

### Field projection

Projection happens at the API call, so the 100-element ISBN array never crosses
the wire.

```
https://openlibrary.org/search.json
  ?q={query}&limit={limit}
  &fields=key,title,author_name,first_publish_year,cover_i
```

The `/works/` prefix is stripped from `key` for compactness, yielding
`OL59863W`.

### Known weakness

Open Library relevance ranking is imprecise: a search for "the dispossessed"
returns *The Lathe of Heaven* in second place. This is not addressable from the
client. Mitigation is to return year and author on every row so the agent can
select correctly, and to keep `limit` large enough to contain the correct
answer.

```
Catalog matches for "le guin dispossessed":
id | title | author | year
OL59863W | The Dispossessed | Ursula K. Le Guin | 1974
OL59858W | The Lathe of Heaven | Ursula K. Le Guin | 1971
Pass an id to add_book.
```

---

## 2. `search_my_books`

Queries the reader's own shelves with optional filters for shelf, text and
minimum rating. All filters are optional, since an agent asking what is on the
list should not have to supply parameters to do so.

An empty result must be actionable, following Chrome's guidance that a failed
call should act as a guide rather than a dead end.

```
No books on your TBR shelf match "tolkien". You have 24 TBR books in total.
```

The second sentence distinguishes an over-narrow filter from an empty shelf, a
distinction the agent cannot otherwise make.

---

## 3. `get_taste_profile`

The central tool of the submission.

Journey A1 requires the agent to understand taste across the entire Read and DNF
history. Within a 1,500-character budget the agent cannot page through 80 books
to derive it; doing so would take a dozen calls and still not fit.

The site therefore performs the aggregation and returns a compact profile. This
is the argument for WebMCP over screen-scraping: the site holds its own data and
can pre-compute the exact summary an agent needs, at a fraction of the token
cost.

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

The Signal line is computed from deterministic heuristics, comparing mean rating
by decade and clustering DNFs by author. It involves no model call. Its purpose
is to supply a hypothesis the agent can reason from rather than counts it must
interpret.

### Cold start

A reader with no history would otherwise receive an empty profile, from which an
agent tends to invent a taste. The tool reports the absence instead.

```
Not enough history yet — 3 books read, none rated. Recommend from the TBR shelf
directly and ask the reader what they're in the mood for.
```

---

## 4. `add_book`

Two input paths exist deliberately. `catalog_id`, obtained from
`search_catalog`, produces a complete record with cover art. `title` and
`author` serve as a fallback when the catalogue fails, which occurs in practice
given the ranking weakness above. Requiring `catalog_id` would block A2 and A3
whenever the agent identifies a book that the catalogue ranks poorly.

Validation failures name the corrective step.

```
Need either catalog_id, or title and author. Call search_catalog first to get a
catalog_id.
```

Deduplication is by `olKey`, and a repeat add is reported as success rather than
error. The photographed-shelf journey re-adds books routinely, and an error
response in that position causes the agent to abandon the sequence.

```
"The Dispossessed" is already on your TBR shelf (added 12 Aug). No change made.
```

---

## 5. `update_book`

Shelf changes and ratings are combined in one tool. Separate `set_status` and
`rate_book` tools would be finer-grained than the underlying intent, since
finishing a book and rating it is a single action for the reader.

An omitted field leaves the value unchanged, and every parameter description
states this explicitly. Without it, agents null out fields they did not intend
to modify.

An unknown `book_id` names the recovery path.

```
No book with id "xyz". Call search_my_books to get current ids.
```

---

## 6. `remove_book`

Permanent deletion, and the only destructive tool in the set.

```js
let confirmed: boolean;
if (!agent?.requestUserInteraction) {
  confirmed = await askReader();
} else {
  try {
    confirmed = await agent.requestUserInteraction(askReader);
  } catch {
    confirmed = await askReader();
  }
}

if (confirmed === false) {
  return err(`Reader declined. "${book.title}" was not removed.`);
}
```

Presence of the method is not a capability check. Some hosts expose
`requestUserInteraction` and then reject with "unsupported" when it is called;
the Codex shim does exactly this. A presence test alone would therefore leave
the reader unasked on those hosts, so the call is additionally wrapped in
`try`/`catch` and falls back to the same dialog.

`askReader` memoises its promise for this reason. A host may invoke the callback
and then fail, and reusing the pending promise prevents the fallback opening a
second dialog competing with the first.

The three paths converge deliberately: whether the host supports the method,
lacks it, or advertises and rejects it, the reader is asked. What the tool never
does is delete silently because a capability was missing.

That dialog is the same one the application's delete control opens, so there is
one path to destroying a book regardless of origin.

The declined case is reported to the agent rather than swallowed, which is what
makes the interaction legible: the agent proposes, the reader decides, and the
agent receives the decision.

---

## 7. `navigate_to`

Changes the current view and nothing else. `view` accepts `shelf`, `book`,
`taste` or `search`, with an optional `book_id`, shelf filter, or pre-filled
query.

Its purpose is to keep the visible state aligned with the conversation. Without
it, the agent names a book while the reader is looking at an unrelated shelf,
and the reply and the screen diverge.

It carries `readOnlyHint` because it touches no data. Changing the view is not a
mutation, and the agent should not treat it as one.

Destination varies by originating tool rather than defaulting to a single route.

| After | Opens |
|---|---|
| `search_catalog` | The catalogue results, which suit a discussion of several books |
| `search_my_books` with one match | That book |
| `add_book` | The book's shelf, with the new card highlighted |
| `update_book` | The changed book |
| `remove_book` | The shelf, as no single surviving book applies |
| `get_taste_profile` | Nothing; the profile is decision context rather than a target |

---

## Steering the agent

WebMCP exposes no prompts primitive. `provideContext()` accepts `{ tools }` and
nothing further; the proposal lists MCP's `resources` and `prompts` as alignment
goals rather than current features. There is no system prompt, no page-level
instruction field, and no mechanism for supplying an agent with a workflow.

Steering therefore occurs through three surfaces the site already controls.

### 1. Descriptions carry preconditions

A description stating only what a tool does leaves call ordering to chance. Each
description names the step before or after it.

> `get_taste_profile` — "…Call this FIRST whenever the reader asks what to read
> next, what they would like, or anything about their reading habits, before
> searching their shelves…"

> `search_my_books` — "…When a named-book search identifies what the reader is
> discussing, follow it with `navigate_to` so that book is on screen."

Cross-references are reciprocal by design. `search_my_books` refers back to
`get_taste_profile` for recommendation questions, and `search_catalog` requires
itself to be called before `add_book` so that books arrive with cover art. All
descriptions remain within the 500-character budget.

### 2. Output chains to the next step

This is the stronger channel: it consumes no description budget and arrives at
the moment it becomes relevant. `get_taste_profile` closes with:

```
Next: call search_my_books with status=tbr, choose ONE book from that shelf,
then call navigate_to with view=book and its book_id BEFORE replying. Say
briefly why it fits this profile.
```

The guidance is conditional rather than blanket. `search_my_books` appends a
recommendation hint only when listing the entire `tbr` shelf, which is the shape
of a "what next?" question, and stays silent on filtered searches, which usually
belong to some other task. Unconditional guidance trains agents to disregard it.

Measured cost: the taste profile grew from 606 to 732 characters when the
navigation handoff was added, and a full TBR listing measures 451. Both sit well
inside the 1,500-character budget.

### 3. The page itself

Agents read the DOM, and that is the documented fallback when tools are not
discovered. The agent popover therefore names the journeys in the reader's own
phrasing:

> "What should I read next?" · "Here's a photo of my shelf — add these to my
> list" · "I finished Piranesi, five stars"

This channel is simultaneously real interface: it orients an agent and tells a
first-time reader what the application does.

### Constraint on guidance text

Next-step guidance travels the same channel as data from `search_catalog`, which
is annotated untrusted because Open Library is publicly editable. Site-authored
guidance is safe, and the rule that keeps it safe is that no guidance line
interpolates catalogue text. Next-step strings remain literal; otherwise a wiki
edit becomes an instruction to the agent.

---

## Cross-cutting decisions

**Registration occurs once and is never repeated.** `provideContext` replaces the
whole toolset while `registerTool` is additive, so a state-dependent toolset
would need to be correct under both semantics. Exposing a tool only on the
screen it relates to would provide no benefit and introduce a class of bug.

**Every error names the next tool to call.** Chrome's guidance is that responses
should act as a guide rather than a dead end, and should never return generic
errors, raw API errors, or fail silently.

**Budgets are asserted rather than remembered.** The limits are 500 characters
per description, 150 per parameter, and 1,500 per output.
`auditToolDescriptors()` checks the first two at start-up. `withinBudget()`
enforces the third, truncating at a row boundary with an explicit marker,
because a table cut mid-row misparses more readily than a short one.

---

## Annotation defaults

The `—` against `add_book` and `update_book` in the table above is not neutral,
and this was learned the expensive way when the host security review rejected
`import_books` ([07-risks.md](07-risks.md), R11).

An omitted annotation is not read as "unspecified". MCP defines defaults, and
they are pessimistic by design:

| Hint | Default when omitted |
|---|---|
| `readOnlyHint` | `false` |
| `destructiveHint` | `true`, for any tool not marked read-only |
| `idempotentHint` | `false` |
| `openWorldHint` | `true` |

So an unannotated mutating tool presents to a host as destructive,
non-idempotent and open-world — a worse profile than `remove_book`, which
actually destroys data but declares its intent and pairs it with a
confirmation. Silence is the loudest possible claim.

`add_book` and `update_book` are additive and corrective respectively; neither
destroys anything, and `update_book` is genuinely idempotent. Both should say
so rather than inheriting the opposite by omission. This is outstanding work,
tracked in [06-roadmap.md](06-roadmap.md).

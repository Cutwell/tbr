# 06 — Roadmap

Deadline: Thursday 3 September 2026, 1:00pm PDT (9:00pm BST), from a project
start on Saturday 29 August. Five days, the last a half day.

## Governing rule

Submission occurs on Wednesday. Thursday is buffer, not schedule.

Devpost submissions remain editable after first submit, so a complete if
imperfect entry filed on Wednesday converts the deadline from a hard cliff into
a revisable target. The common failure mode is a video upload completing after
the cutoff.

---

## Plan

### Day 1 — Spike the unknowns (complete)

Establish first that a page can register tools an agent discovers. No other work
matters if this fails.

- [x] Confirm ChatGPT's in-app browser exposes Site tools and lists TBR's
- [x] Confirm the namespace in use, and that `adapter.ts` registers against it
- [x] Prove the deployment path end to end with a live URL

Exit criteria met. R1 in [07-risks.md](07-risks.md), the namespace divergence
producing a silent zero-tools failure, is closed against the judging surface
rather than only a local harness. Three lower-level protocol questions remain
open and are recorded in [02-webmcp-reference.md](02-webmcp-reference.md); all
three were downgraded from blocking once end-to-end behaviour was verified.

### Day 2 — The human application (complete, finished on Day 1)

Built as though WebMCP did not exist, since the product must stand alone.

- [x] Next.js 16, React 19, TypeScript and Tailwind v4 scaffold
- [x] `store.ts` with subscribe/emit and `localStorage` persistence
- [x] `openlibrary.ts`: search with field projection, covers, typographic fallback
- [x] Shelf screen: filter chips with counts, book grid, empty state
- [x] Search screen: debounced search, results, add on tap
- [x] Shelf changes, star ratings, removal with confirmation
- [x] Manual add-by-title path
- [x] Light and dark themes; atoms → molecules → organisms → templates

Exit criteria met: books can be added, shelved, rated and removed by hand, and
the result is presentable.

### Day 3 — The tools (complete, finished on Day 1)

- [x] `adapter.ts`: both namespaces, both registration styles
- [x] `format.ts`: `ok()`, `err()`, pipe-table renderer, `withinBudget()` guard
- [x] Tools 1–5: `search_catalog`, `search_my_books`, `get_taste_profile`,
      `add_book`, `update_book`
- [x] `profile.ts`: the aggregation and the heuristic Signal line
- [x] `remove_book`, with `requestUserInteraction` and a direct-dialog fallback
- [x] `AgentIndicator`: connection status and a live tool-call log
- [x] `auditToolDescriptors()`: start-up assertions on the character budgets
- [x] `window.__tbrTools` development harness, for calling tools without an agent

Exit criteria met: every tool callable, every output within 1,500 characters,
every error path naming a next step.

### Day 4 — First run, polish, rehearse

- [x] Demo library: 80 books with real covers and deliberate taste signal
      (loaded on request from the first-run panel, not seeded automatically)
      ([05-architecture.md](05-architecture.md))
- [x] Explicit unsupported state when no WebMCP host is present
- [x] `navigate_to`, aligning on-screen state with the conversation
      ([04-tool-design.md](04-tool-design.md))
- [x] Persistent Open Library cache; warm reload issues no network requests
- [x] Repository hygiene: README, MIT `LICENSE`, reviewable commit history
- [ ] Full rehearsal of A1, A2 and A3 in ChatGPT's in-app browser, on a cold
      profile, against the deployed URL
- [ ] Resolve what the rehearsal exposes, tuning descriptions before code where
      possible

The rehearsal is the purpose of this day. Tool descriptions function as prompts
and require iteration, which requires a working rehearsal loop.

### Day 5 — Record and submit

- [ ] Record the demo against the script in [08-submission.md](08-submission.md).
      Budget three to four takes; the sub-3:00 limit is hard
- [ ] Upload to YouTube as Public rather than Unlisted, verified in a private
      window
- [ ] Finalise the submission text with live URLs
- [ ] Capture screenshots: the shelf, the Site tools panel, the confirmation
      dialog
- [ ] Submit on Devpost

### Day 6 — Buffer

Reserved for resolving what Wednesday exposes. Existing submissions are edited;
nothing new begins. Production changes stop by 11am PDT.

---

## Status

Days 1 to 3 are complete and were delivered ahead of schedule. The following
exists:

- The full human application: four routes, light and dark, responsive, opening
  on an empty shelf with a four-way first-run panel (the 80-book demo library
  is one of its options)
- Seven WebMCP tools. The first six are verified live in the ChatGPT browser;
  `navigate_to` postdates that pass and awaits confirmation there
- Agent steering across all three channels
  ([04-tool-design.md](04-tool-design.md))
- A static export deployed to Vercel, with the live URL in the
  [README](../README.md)
- MIT `LICENSE`, README, and this documentation

Outstanding work, in priority order:

1. **The demo video.** Not started, and the largest remaining task. It is
   mandatory and therefore on the critical path.
2. **Cold-profile verification** of the live URL in ChatGPT's browser, covering
   the indicator reading "7 tools live" and a walkthrough of A1, A2 and A3.
3. **Devpost submission**: text, screenshots, links, filed Wednesday.

Done since: **every tool now states every applicable annotation**
([04-tool-design.md](04-tool-design.md), Annotation defaults). Writing them out
changed two answers against expectation — `openWorldHint` was incorrect on five
of seven tools, and `update_book` is genuinely destructive rather than merely
"corrective", so it declares that instead of the flattering version.

Accepted gaps:

- A transient cover failure falls back for the remainder of that session rather
  than retrying. It self-heals on reload; the underlying rate is 3 of 80 books
  with no cover art at all.
- No reset control in the interface, by design; `resetList()` and `loadDemo()`
  on `window` serve that need instead ([05-architecture.md](05-architecture.md)).

---

## Cut list

Agreed in advance and cut from the top as days slip. Nothing has been cut.

1. Goodreads import entirely, dropping J6 as the weakest of the six
2. The `note` field, removing a parameter from two schemas
3. Era analysis in the taste profile, retaining authors and ratings only

Excluded from cutting: `get_taste_profile`, the demo library,
`requestUserInteraction`, and the agent activity indicator. These four map
directly onto WebMCP Leverage and human-agent collaboration, which is half the
rubric.

## Time-boxed work

Two areas reliably consume disproportionate time without affecting the score.

- **Cover art edge cases.** The typographic fallback is sufficient.
- **Tool description tuning.** Bounded by the rehearsal. Further wording
  improvements are always available; further days are not.

# 06 — Roadmap

**Deadline: Thursday 3 September 2026, 1:00pm PDT** (9:00pm BST), from a start
on Saturday 29 August. Five days, and the last is a half day.

## The governing rule

> **Submit on Wednesday. Thursday is buffer, not schedule.**

Devpost submissions can be edited after the first submit, so getting a complete
— even imperfect — entry in on Wednesday converts the deadline from a cliff into
something you can improve against. Every year people lose to a YouTube upload
finishing at 1:04pm.

---

## The plan

### Day 1 — Spike the unknowns ✅

Prove the risky thing first: that a page can register tools an agent actually
finds. Nothing else matters if this fails.

- [x] Confirm ChatGPT's in-app browser exposes **Site tools** and lists TBR's
- [x] Confirm which namespace it uses, and that `adapter.ts` registers against it
- [x] Prove the deploy path end to end with a live URL

**Exit criteria met.** R1 in [07](07-risks.md) — the namespace divergence causing
a silent zero-tools failure — is closed against the real judging surface, not
just a local harness. Three lower-level protocol questions remain open and are
recorded honestly at the bottom of [02](02-webmcp-reference.md); all three were
downgraded from blocking to nice-to-confirm once end-to-end behaviour worked.

### Day 2 — The human app ✅ *finished early, on Day 1*

Build the product as if WebMCP did not exist. It has to stand alone.

- [x] Next.js 16 + React 19 + TS + Tailwind v4 scaffold
- [x] `store.ts` with subscribe/emit and `localStorage` persistence
- [x] `openlibrary.ts` — search with field projection, covers, typographic fallback
- [x] Shelf screen: filter chips with counts, book grid, empty state
- [x] Search screen: debounced search, results, tap to add
- [x] Shelf changes, star ratings, remove with confirmation
- [x] Manual "add by title" escape hatch
- [x] Light and dark themes; atoms → molecules → organisms → templates

**Exit criteria met:** add, shelve, rate and remove by hand, and it looks good
enough to screenshot.

### Day 3 — The tools ✅ *finished early, on Day 1*

- [x] `adapter.ts` — both namespaces, both registration styles
- [x] `format.ts` — `ok()`, `err()`, pipe-table renderer, `withinBudget()` guard
- [x] Tools 1–5: `search_catalog`, `search_my_books`, `get_taste_profile`,
      `add_book`, `update_book`
- [x] `profile.ts` — the aggregation and the heuristic **Signal** line
- [x] `remove_book` with `requestUserInteraction` and a direct-dialog fallback
- [x] `import_books`, sharing its parser with the UI paste box
- [x] `AgentIndicator` — connection status and a live tool-call log
- [x] `auditToolDescriptors()` — start-up assertions on the character budgets
- [x] `window.__tbrTools` dev harness, so tools are callable with no agent at all

**Exit criteria met:** every tool callable, every output inside 1,500 characters,
every error path naming a next step.

### Day 4 — Seed, polish, rehearse

- [x] **Seed library** — 80 books with real covers and deliberate taste signal
      ([05](05-architecture.md))
- [x] Honest "agent features unavailable" state when no host is present
- [x] `navigate_to`, so the screen follows the conversation
      ([04](04-tool-design.md))
- [x] Persistent Open Library cache — warm reload makes zero network requests
- [x] Repo hygiene: README, MIT `LICENSE`, reviewable commit history
- [ ] **Full rehearsal of A1, A2 and A3** in ChatGPT's in-app browser, on a cold
      profile, against the deployed URL
- [ ] Fix what the rehearsal breaks — expect the agent to call tools in an order
      you did not anticipate, and tune descriptions rather than code

The rehearsal is the point of this day. Tool descriptions are prompts; they need
iteration, and iteration needs a working loop.

### Day 5 — Record and submit

- [ ] Record the demo — script in [08](08-submission.md). Budget 3–4 takes;
      **under 3:00 is a hard rule**
- [ ] Upload to YouTube as **Public**, not Unlisted, and verify in a private window
- [ ] Finalise the submission text with the real URLs
- [ ] Screenshots: the shelf, the Site tools panel, the confirmation dialog
- [ ] **Submit on Devpost**

### Day 6 — Buffer

Only for fixing what Wednesday exposed. Edit the existing submission; start
nothing new. Stop touching production by 11am PDT.

---

## Where it stands

**Days 1–3 are complete and landed ahead of schedule.** What exists:

- The full human app — four routes, light and dark, responsive, 80-book library
- All eight WebMCP tools; the first seven verified live in the ChatGPT browser,
  `navigate_to` added after that pass and still to be confirmed there
- Agent steering across all three channels ([04](04-tool-design.md))
- Static export deployed to Vercel, with the live URL in the [README](../README.md)
- MIT `LICENSE`, README, and this folder

**What remains, in priority order:**

1. **The demo video.** Not started, and by some distance the largest remaining
   task. Mandatory, so it is the critical path.
2. **Cold-profile verification** of the live URL in ChatGPT's browser, including
   the indicator reading "8 tools live" and a walk through A1, A2 and A3.
3. **Devpost submission** — text, screenshots, links, submitted Wednesday.

**Known gaps, accepted:**

- A transient cover failure falls back for that session rather than retrying. It
  self-heals on reload; the true rate is 3 of 80 books with no cover art at all.
- No reset control in the UI, by design ([05](05-architecture.md)).

---

## Cut list — decided in advance, not at midnight

In order. Cut from the top when a day slips. Nothing has been cut so far.

1. **`import_books` as a tool** → UI-only paste box; the journey still demos
2. **Goodreads import entirely** → drop J6, the weakest of the six
3. **The `note` field** → drops a parameter from two schemas
4. **Era analysis** in the taste profile → keep authors and ratings only

**Never cut:** `get_taste_profile`, the seed library, `requestUserInteraction`,
or the agent activity indicator. Those four *are* the submission — they map
directly onto WebMCP Leverage and "humans and agents working together", which is
half the rubric.

## Time-boxed, not open-ended

Two things reliably eat a hackathon and neither is scored:

- **Cover art edge cases.** Ship the typographic fallback and move on.
- **Tool description tuning.** Time-box it to the rehearsal. There is always
  another wording; there is not always another day.

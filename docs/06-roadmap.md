# 06 — Roadmap

**Deadline: Thursday 3 September 2026, 1:00pm PDT** (= 9:00pm BST).
**Today: Saturday 29 August 2026.**

That is five working days plus a Thursday morning.

## The governing rule

> **Submit on Wednesday. Thursday is buffer, not schedule.**

Devpost submissions can be edited after first submit. Getting a complete —
even imperfect — submission in on Wednesday converts the deadline from a cliff
into a deadline you can improve against. Every year people lose to a YouTube
upload finishing at 1:04pm.

---

## Day 1 — Saturday 29 Aug: **Spike the unknowns** ✅ *verified, some detail unresolved*

Days 2 and 3 ran ahead of schedule. All seven tools have since been exercised
live in ChatGPT's in-app browser — registered, listed under **Site tools**,
callable, and returning usable output. R1 in [07-risks.md](07-risks.md) (the
namespace divergence causing a silent zero-tools failure) is resolved against
the real judging surface, not just the local dev harness.

- [x] Confirm the ChatGPT in-app browser exposes **"Site tools"** and lists
      TBR's seven tools
- [x] Confirm which namespace ChatGPT exposes; `adapter.ts` registers
      successfully against it
- [x] Deploy path proven — a live URL works end-to-end
- [ ] Q1–Q3 from [02-webmcp-reference.md](02-webmcp-reference.md) (exact return
      shape accepted, whether `requestUserInteraction` fired natively vs. the
      fallback, overrun behaviour) were **not individually instrumented** —
      the app worked regardless of which code path ran, so it isn't known
      which one did. Worth confirming Q2 specifically before the demo video,
      since the human-in-the-loop beat depends on it.

**Exit criteria met:** a live URL with tools callable from ChatGPT's in-app
browser. The three low-level protocol questions remain open in writing at the
bottom of [02](02-webmcp-reference.md), downgraded from blocking to
nice-to-confirm now that end-to-end behaviour is verified.

---

## Day 2 — Sunday 30 Aug: **The human app** ✅ *done early, 29 Aug*

Build the product as if WebMCP did not exist. It has to stand alone.

- [x] Next.js 16 + React 19 + TS + Tailwind v4 scaffold (Next over Vite: static
      export, one-step deploy to Vercel/Netlify, `next/font` self-hosting)
- [x] `store.ts` with subscribe/emit; `localStorage` persistence
- [x] `openlibrary.ts` — search with `fields` projection, cover URLs, typographic
      fallback cover
- [x] **Shelf screen**: filter chips with counts, book grid, empty state
- [x] **Add screen**: debounced search, results, tap to add → TBR
- [x] Shelf changes (J2), star rating (J5), remove with confirm + undo toast (J4)
- [x] Manual "add by title" escape hatch
- [x] Light/dark themes, atoms → molecules → organisms → templates

**Exit criteria:** you can add, shelve, rate and remove books by hand, and it
looks good enough to screenshot. **Met.**

---

## Day 3 — Monday 31 Aug: **The tools** ✅ *done early, 29 Aug*

- [x] `adapter.ts` — both namespaces, both registration styles
- [x] `format.ts`: `ok()`, `err()`, pipe-table renderer, `withinBudget()` guard
      truncating at a row boundary with an explicit marker
- [x] Tools 1–5 (`search_catalog`, `search_my_books`, `get_taste_profile`,
      `add_book`, `update_book`)
- [x] `profile.ts` — the aggregation and the heuristic **Signal** line
- [x] Tool 6 `remove_book`, with `requestUserInteraction` *and* a direct-dialog
      fallback for hosts that lack it
- [x] Tool 7 `import_books` — shares its parser with the UI paste box
- [x] `AgentPanel.tsx` — connection status and a live tool-call log
- [x] `auditToolDescriptors()` — dev-time assertions on the character budgets
- [x] `window.__tbrTools` dev harness; all seven exercised from the console

Measured output: `get_taste_profile` 606 chars, `search_my_books` (5 of 24)
352 chars, `search_catalog` 161 chars — all well inside the 1,500 budget.

**Exit criteria:** all tools callable, each under 1,500 characters, each error
path naming a next step. **Met** — though verification so far is via the dev
harness, *not* a real host. See Day 1 below, which is now the critical path.

---

---

# STATUS — Sunday 30 August, 4 days 7 hours to deadline

Days 1–3 are complete and ahead of schedule. **Everything below this line is
what remains.**

## Done

- The full human app: four routes (`/`, `/search`, `/taste`, `/book?id=`),
  light and dark, responsive, 80-book seeded library
- All seven WebMCP tools, **verified live in the ChatGPT browser**
- Agent steering: sequencing in tool descriptions, next-step chaining in tool
  output, suggested prompts in the UI ([04](04-tool-design.md))
- Performance: persistent Open Library cache (warm reload = zero network),
  right-sized covers, skeleton loading ([05](05-architecture.md))
- Static export (`output: "export"`) — deployable to any accepted host
- MIT `LICENSE`, README, this `docs/` folder

## Remaining — in priority order

### 1. Get the code into a public repo ✅ *committed locally, push pending*
Work is split into seven reviewable commits (scaffold cleanup, static-export
config + licence, theme/layout, data layer, component library, app routes,
and a UI fix) against `origin` = `https://github.com/Cutwell/tbr`. The final
`git push` needs to run from a machine with GitHub credentials — it couldn't
run from the sandboxed environment that made the commits.

- [x] Commit the work in reviewable chunks
- [x] `git push -u origin main` — pushed, after rebasing onto the repo's real
      prior history and resolving an Apache-vs-MIT `LICENSE` conflict in
      MIT's favour (the docs' own requirement)
- [x] Confirm `LICENSE` is present at the root and the repo is **public**
      (verified: unauthenticated `git ls-remote` succeeds)

### 2. Deploy, and verify the live URL
**Decision made: Vercel, not ChatGPT Sites.** See
[05-architecture.md](05-architecture.md#decision-vercel-not-chatgpt-sites) for
the reasoning — three real-if-non-fatal risks (UK/EEA availability, the
public-sharing default, beta maturity) weren't worth carrying against this
deadline.

- [x] Deploy to Vercel — see [README.md](../README.md) for the live URL
- [ ] Open the deployed URL in the ChatGPT browser on a **cold profile** and
      confirm the indicator reads "7 tools live"
- [ ] Walk A1, A2 and A3 end to end against the deployed site

### 3. Record the demo video ⚠️ *not started — the largest remaining task*
Mandatory: under 3 minutes, public YouTube, with audio. Script and shot list are
already written in [08-submission.md](08-submission.md).
- [ ] Rehearse A1 ("what should I read next?") — the flagship, most of the value
- [ ] Record; budget 3–4 takes
- [ ] Upload as **Public**, not Unlisted, and verify in a private window

### 4. Finalise and submit
- [ ] Update the submission text with the real URLs ([08](08-submission.md))
- [ ] Screenshots: the shelf, ChatGPT's Site tools panel, the confirmation dialog
- [ ] **Submit on Devpost Wednesday**, leaving Thursday as buffer

## Known gaps, accepted

- A transient cover failure falls back for that session rather than retrying.
  Self-heals on reload; true rate is 3 of 80 books with no cover art.
- No reset control in the UI by design — resetting is a documented
  `localStorage` deletion in the README.

## Day 4 — Tuesday 1 Sep: **Seed, polish, and rehearse**

- [ ] **Seed library** — 60–90 books with real covers and deliberate taste signal
      ([05](05-architecture.md)). Do this first; everything else depends on it.
- [x] ~~"Reset demo library" control~~ — cut; documented in the README instead
- [ ] "Unsupported browser" banner with setup link
- [ ] `import_books` if it survived Day 3
- [ ] **Full rehearsal of all three agent journeys in ChatGPT's in-app browser**,
      on a cold profile
- [ ] Fix what the rehearsal breaks — expect the agent to call tools in an order
      you did not anticipate, and tune descriptions rather than code where
      possible
- [ ] Repo hygiene: README with run instructions, **LICENCE file (MIT)**, clean
      commit history

**Exit criteria:** a cold-profile run of A1, A2 and A3 in ChatGPT's browser,
end to end, with nothing hand-held.

The rehearsal is the point of this day. Tool descriptions are prompts — they will
need iteration, and iteration needs a working rehearsal loop.

---

## Day 5 — Wednesday 2 Sep: **Record and submit**

- [ ] Record the demo — script in [08-submission.md](08-submission.md).
      Budget 3–4 takes; **under 3:00 is a hard rule**
- [ ] Upload to YouTube, set **Public** (not Unlisted — rules say public), verify
      in an incognito window
- [ ] Write the submission text ([08](08-submission.md))
- [ ] Final deploy; test the live URL on a machine that has never run the app
- [ ] **Submit on Devpost**
- [ ] Post-submit: re-read the submission as a stranger would

**Exit criteria: submitted.**

---

## Day 6 — Thursday 3 Sep (until 1pm PDT / 9pm BST): **Buffer**

Only for fixing what Wednesday exposed. Edit the existing submission; do not
start anything new. Stop touching production by 11am PDT.

---

## Cut list — decide now, not at midnight

In order. Cut from the top when a day slips.

1. **`import_books` as a tool** → UI-only paste box (journey still demonstrated)
2. **Goodreads import entirely** → drop journey J6; it is the weakest of the six
3. **`note` field** on books → drops a parameter from two schemas
4. **Import screen** → fold into a menu item
5. **Era/decade analysis** in the taste profile → keep authors and ratings only

Never cut: `get_taste_profile`, the seed library, `requestUserInteraction`, or
the agent activity indicator. Those four *are* the submission — they map
directly onto "WebMCP Leverage" and "humans and agents working together", which
is half the rubric.

## Time-boxed, not open-ended

Two things reliably eat a hackathon and neither is scored:

- **Cover art edge cases.** Ship the typographic fallback and move on.
- **Tool description tuning.** Time-box to Tuesday's rehearsal. There is always
  another wording; there is not always another day.

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

## Day 1 — Saturday 29 Aug: **Spike the unknowns**

No product work today. Three open questions from
[02-webmcp-reference.md](02-webmcp-reference.md) determine the shape of all seven
tools, and guessing wrong costs a rebuild on Day 3.

- [ ] Install the [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) extension
- [ ] Enable `chrome://flags/#enable-webmcp-testing`, relaunch
- [ ] Install the ChatGPT desktop app; confirm the in-app browser and its
      **"Site tools"** address-bar panel
- [ ] Build a throwaway single-page app with **one** tool (`echo`) and deploy it
      to Vercel/Netlify **today** — proving the deploy path early is worth more
      than any feature
- [ ] **Answer Q1:** does ChatGPT accept `{content:[{type:'text',…}]}`, or a bare
      object? Try both.
- [ ] **Answer Q2:** does `agent.requestUserInteraction()` work in ChatGPT's
      browser, or Chrome only? This decides whether tool #6 is the demo
      centrepiece or a fallback modal.
- [ ] **Answer Q3:** what happens past 1,500 characters — truncate, error, or
      nothing?
- [ ] Confirm which namespace each host exposes; finalise `adapter.ts`
- [ ] Fork and skim one OpenAI reference app (Mabel's Table for state handling,
      Kurio for search/cart shape)

**Exit criteria:** a live URL with one working tool, callable from ChatGPT's
in-app browser, and all three questions answered in writing at the bottom of
[02](02-webmcp-reference.md).

If the deploy or the ChatGPT connection is not working by end of Saturday, that
is the emergency — not the feature list.

---

## Day 2 — Sunday 30 Aug: **The human app**

Build the product as if WebMCP did not exist. It has to stand alone.

- [ ] Vite + React + TS + Tailwind scaffold
- [ ] `store.ts` with subscribe/emit; `localStorage` persistence
- [ ] `openlibrary.ts` — search with `fields` projection, cover URLs, typographic
      fallback cover
- [ ] **Shelf screen**: filter chips with counts, book grid, empty state
- [ ] **Add screen**: debounced search, results, tap to add → TBR
- [ ] Shelf changes (J2), star rating (J5), remove with undo toast (J4)
- [ ] Manual "add by title" escape hatch

**Exit criteria:** you can add, shelve, rate and remove books by hand, and it
looks good enough to screenshot.

---

## Day 3 — Monday 31 Aug: **The tools**

- [ ] `adapter.ts` finalised against Day 1 findings
- [ ] `format.ts`: `ok()`, `err()`, pipe-table renderer, `budget()` guard with
      non-mid-row truncation
- [ ] Tools 1–5 (`search_catalog`, `search_my_books`, `get_taste_profile`,
      `add_book`, `update_book`)
- [ ] `profile.ts` — the aggregation and the heuristic **Signal** line
- [ ] Tool 6 `remove_book` with `requestUserInteraction` (or fallback modal per
      Day 1 findings)
- [ ] `AgentActivity.tsx` — the live "tool fired" indicator
- [ ] Build-time assertions on name/description/output character budgets
- [ ] Verify every tool through the Inspector extension

**Exit criteria:** all tools callable from the Inspector, each returning under
1,500 characters, each error path naming a next step.

**If Monday runs late:** cut `import_books` (tool 7) to a UI-only paste box. That
is the pre-agreed cut — see the cut list below.

---

## Day 4 — Tuesday 1 Sep: **Seed, polish, and rehearse**

- [ ] **Seed library** — 60–90 books with real covers and deliberate taste signal
      ([05](05-architecture.md)). Do this first; everything else depends on it.
- [ ] "Reset demo library" control
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

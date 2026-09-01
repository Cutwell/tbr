# 07 — Risk Register

Ordered by expected damage. The first four are capable of losing the submission
outright.

---

### R1 — Judges open the URL and see no tools

**Impact: fatal · Status: closed**

The divergence between `document.modelContext` and `navigator.modelContext`
([02-webmcp-reference.md](02-webmcp-reference.md)) means that registering
against the wrong namespace yields an application with no agent capability and
no error message.

**Mitigation.** The adapter shim supports both namespaces and both registration
styles. A visible ready/unsupported status in the header makes the failure
observable rather than silent.

**Status.** The first six of the current seven tools registered and were callable
live in ChatGPT's in-app browser. (That pass covered seven, but one of them was
`import_books`, since withdrawn — see R11.) Chrome has not been separately
re-checked but shares the code path. `navigate_to` postdates that verification
and should be confirmed during the rehearsal, against the deployed URL rather
than localhost.

---

### R2 — Cold-start demonstration has no data

**Impact: fatal to the primary journey · Status: closed, by a different means
than originally planned**

A judge with empty `localStorage` asking what to read next receives an accurate
report of insufficient history from `get_taste_profile`. The primary journey
produces nothing for the intended audience.

**Original mitigation.** 80 books seeded automatically on first visit.

**Why that was replaced.** Auto-seeding traded one problem for a worse one. It
filled a stranger's reading list with books they had never read, without
asking, and it obscured the premise that the shelf is theirs — a reading list
that arrives pre-populated is not a reading list. The risk it was guarding
against is real, but the guard was aimed at the demo rather than the product.

**Current mitigation.** The library starts empty and the shelf renders a
first-run panel offering four ways in, one of which loads the same curated
demo library on request ([05-architecture.md](05-architecture.md)). A judge is
one click from a full 80-book profile, and a reader is zero clicks from a list
that is actually theirs. `resetList()` and `loadDemo()` on `window` move
between the two states without a reload.

**Residual risk.** A judge who neither reads the panel nor clicks anything
still sees an empty shelf, which is one interaction more than before. The panel
is the whole page at that point, the demo card names what it does, and the
demo remains a single click, so the exposure is small and is the price of not
writing to someone's list unasked.

---

### R3 — Submission incomplete at the deadline

**Impact: fatal · Status: open; the video is the critical path**

Four mandatory artefacts. The two most frequently omitted are the open-source
licence file and the video's public rather than unlisted visibility. YouTube
processing on a large upload can exceed the remaining time.

**Mitigation.** Submit Wednesday and hold Thursday as buffer
([06-roadmap.md](06-roadmap.md)). The MIT licence was added on the first day
rather than the last. Video visibility is verified in a private window.

---

### R4 — Output budget overruns corrupt agent behaviour

**Impact: severe · Status: mitigated; never observed**

The 1,500-character limit is easy to exceed, given that Open Library returns
2,838 bytes for two books. An overrun causes truncation mid-row, a malformed
table, and an agent that misreads the data without detecting the fault.

**Mitigation.** Pipe-delimited rows rather than JSON, `limit` defaulting to 10,
field projection at the API call, and a `budget()` guard truncating at a row
boundary with an explicit marker.

**Status.** The largest measured output is 732 characters, under half the
budget, so the guard has not fired in practice.

---

### R5 — `requestUserInteraction` unsupported in ChatGPT's browser

**Impact: moderate · Status: open, unmeasured rather than unresolved**

The method appears in the W3C proposal and in Chrome's documentation. ChatGPT's
site-tools page does not mention it. If unavailable, the human-in-the-loop
demonstration does not run natively on the primary judging surface.

**Mitigation.** The call is guarded on both absence and failure, and blocks only
on an explicit `false`, so the tool never hard-fails. The fallback is the
application's own dialog, which is the same one the reader's delete control
opens.

**Status.** Partially measured. A host can expose `requestUserInteraction` and
then reject with "unsupported" when it is called, which the Codex shim does, so
presence alone is not a capability check; `remove_book` now catches that
rejection and falls back. Which branch executes in ChatGPT's browser
specifically is still unlogged. It should be confirmed before recording so that
the video describes the path that actually runs.

---

### R6 — Open Library returns the wrong book during recording

**Impact: moderate · Status: accepted, mitigated**

Verified: searching "the dispossessed" ranks *The Lathe of Heaven* second. In a
live demonstration, an agent adding the wrong book presents as a product defect.

**Mitigation.** Return year and author on every row to support disambiguation by
both agent and reader; keep `limit` at 10 so the correct answer falls in range;
rehearse with the exact queries used on camera; retain the manual add path as a
visible fallback; select demonstration books that rank first.

**Related, and fixed.** A worse version of this was found on Day 4: `q` is a
Lucene query string, so `"Title - Author"` returned *nothing at all* and
`"Title by Author"` returned the wrong book. Both are the most natural way a
person types a search. `normalizeQuery` now neutralises the operators before
the request ([05-architecture.md](05-architecture.md)). Worth noting the
distinction — R6 is imprecise ranking, which cannot be fixed from the client;
that was malformed queries, which could.

---

### R7 — Agent writes do not appear in the interface

**Impact: severe, to the video · Status: closed architecturally**

Tools bypassing the store would leave the agent's changes invisible until
reload, removing the visible result of agent activity.

**Mitigation.** Structural rather than procedural. Tools call `store.*` and
never `localStorage` or React state ([05-architecture.md](05-architecture.md)),
and the store is consumed through `useSyncExternalStore` so that external writes
re-render the tree.

---

### R8 — Prompt injection via catalogue data

**Impact: reputational, and a scored opportunity · Status: mitigated**

Open Library is a public wiki. A record edited to contain instructions reaches
the agent's context through `search_catalog`.

**Mitigation.** `untrustedContentHint: true` on that tool, and a rule that no
next-step guidance line interpolates catalogue text
([04-tool-design.md](04-tool-design.md)). The issue is documented rather than
concealed, as it constitutes concrete evidence of implementation depth.

---

### R9 — Scope creep

**Impact: moderate · Status: held**

Series tracking, page counts, reading streaks and social features are all
plausible additions and none is scored.

**Mitigation.** The cut list in [06-roadmap.md](06-roadmap.md), agreed in
advance. Anything absent from [03-product-spec.md](03-product-spec.md) waits
until after submission.

---

### R10 — Specification changes during the project

**Impact: variable · Status: low over five days**

WebMCP is a live draft, and the API changed shape between the August 2025
proposal and the shipping implementations.

**Mitigation.** The adapter isolates every host assumption in one file. Both
sets of documentation are re-checked on Wednesday morning before the final
deployment.

---

### R11 — Host security review rejects a tool call

**Impact: moderate · Status: closed by removing the tool**

The browser's security review blocked `import_books` at call time. The tool was
withdrawn rather than reworked. Four properties made it the most likely tool in
the set to be rejected, and they are listed in the order they probably weighed:

1. **It declared no annotations.** MCP's defaults for an omitted annotation are
   pessimistic — `readOnlyHint: false`, `destructiveHint: true` for anything not
   read-only, `idempotentHint: false`, `openWorldHint: true`. So the tool
   presented as destructive, non-idempotent and open-world, a worse profile than
   `remove_book`, which genuinely destroys data but says so and confirms first.
2. **The payload was the shape these reviews exist to catch.** Its one required
   argument was an unbounded free-text `csv` string. To call it, an agent must
   first acquire a large blob of content from outside the page and write it into
   the site in bulk. Content crossing from one origin into a mutating write on
   another is the canonical interception pattern, and no annotation changes it.
3. **Unbounded blast radius with no human in the loop.** No length cap on the
   argument, no row cap in the parser, no cap in `addMany` — one call, N records
   committed — and, unlike `remove_book`, no confirmation step at all.
4. **Undeclared side effects.** It also drove navigation and raised a
   notification, neither of which its description mentioned.

**Why removal rather than repair.** Only 1, 3 and 4 are fixable from inside the
application. 2 is structural, so a repaired tool might well have been rejected
again, after spending time that R3 says belongs to the video. The decisive point
is that nothing depended on it: the parser was always shared with a first-class
UI paste field, so J6 lost nothing. It was already item 1 on the cut list in
[06-roadmap.md](06-roadmap.md), agreed before any of this happened.

**What it leaves behind.** Point 1 applies unchanged to `add_book` and
`update_book`, which also declare nothing and therefore also present as
destructive. That is now the annotation gap tracked in
[04-tool-design.md](04-tool-design.md) and item 4 of the outstanding work in
[06-roadmap.md](06-roadmap.md). The general lesson is worth stating plainly:
under MCP, an omitted annotation is not a neutral absence of a claim. It is the
most alarming claim available.

**Residual risk.** The exact rejection text was not captured before the tool was
removed, so the ranking above is inference from the tool's properties rather
than a quoted cause. If a second tool is rejected during the rehearsal, capture
the message verbatim first — it discriminates between cause 1, which is a
ten-minute fix, and cause 2, which is not fixable at all.

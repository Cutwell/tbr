# 07 — Risk Register

Ordered by expected damage. The top four are the ones that can lose the
submission outright.

---

### R1 — Judges open the URL and see no tools
**Likelihood: resolved · Impact: fatal**

The `document.modelContext` vs `navigator.modelContext` divergence
([02](02-webmcp-reference.md)) means registering against the wrong namespace
produces an app with zero agent capability and no error message.

**Mitigation:** the adapter shim, supporting both namespaces and both
`registerTool` and `provideContext`. Show a visible
"agent tools: ready / unsupported" status in the UI so the failure is loud
rather than silent.

**Status:** verified — all seven tools registered and callable live in the
ChatGPT in-app browser, TBR's judging surface. Not yet separately re-checked
in Chrome, but the shared adapter code path makes that low-risk. Re-verify
against the final deployed URL (not just localhost) before submission.

---

### R2 — Cold-start demo has no data
**Likelihood: high if unaddressed · Impact: fatal to the headline journey**

A judge with empty `localStorage` asks "what should I read next?" and
`get_taste_profile` truthfully answers "not enough history". The flagship journey
produces nothing for the one person who matters.

**Mitigation:** seed 60–90 books on first visit, with deliberate taste signal
([05](05-architecture.md)). Recovery is a documented `localStorage` deletion
rather than a button: a control that wipes the reader's list does not belong in
a reading list, and an accidental click on camera would be worse than the
problem it solves. **This is scheduled first on Day 4 and must not slip** — it
is the single highest-leverage hour in the project.

---

### R3 — Submission is incomplete at the deadline
**Likelihood: medium · Impact: fatal**

Four mandatory artefacts, and the two most likely to be forgotten are the
**open-source licence file** and the video being **public rather than unlisted**.
YouTube processing on a large upload can take longer than you have.

**Mitigation:** submit Wednesday, buffer Thursday ([06](06-roadmap.md)). Add the
MIT licence file on Day 2, not Day 5. Check the video in an incognito window.

---

### R4 — Output budget overruns corrupt agent behaviour
**Likelihood: high without discipline · Impact: severe**

1,500 characters is easy to exceed — Open Library returns 2,838 bytes for two
books. Depending on host behaviour (unknown until the Day 1 spike), overrun means
truncation mid-row, a malformed table, and an agent that misreads the data
without knowing it did.

**Mitigation:** pipe-delimited rows instead of JSON, `limit` defaulting to 10,
field projection at the API call, a `budget()` guard that truncates at a row
boundary and appends an explicit marker, and build-time assertions. Never
truncate silently.

---

### R5 — `requestUserInteraction` is not supported in ChatGPT's browser
**Likelihood: unconfirmed · Impact: moderate**

It appears in the W3C proposal and Chrome's docs; ChatGPT's site-tools page does
not mention it. If unavailable, the human-in-the-loop demo — a deliberate
centrepiece — does not run on the primary judging surface.

**Mitigation:** code defensively (`agent?.requestUserInteraction?.()`, proceed
on `undefined`, block only on an explicit `false`) so the tool never
hard-fails. If unsupported, fall back to our own modal driven by store state,
demo it in Chrome, and describe the difference honestly in the submission
text. Do not claim a capability the judge's browser will not reproduce.

**Status:** `remove_book` worked end-to-end in the ChatGPT browser during
verification, but which branch actually ran — native
`requestUserInteraction` or the fallback modal — was not logged or observed
directly, so this risk is not closed, only unmeasured. See the note in
[02-webmcp-reference.md](02-webmcp-reference.md#open-questions--status-after-day-1).
Confirm before the demo video: the script's human-in-the-loop beat should
describe whichever path is actually live, not assume the native one.

---

### R6 — Open Library relevance returns the wrong book on camera
**Likelihood: high (observed) · Impact: moderate**

Verified: searching "the dispossessed" ranks *The Lathe of Heaven* second. During
a live demo, an agent adding the wrong book looks like a broken product.

**Mitigation:** return year and author on every row so both agent and human can
disambiguate; keep `limit` at 10 so the correct answer is in range; rehearse with
the exact queries used on video; and keep the manual add path as a visible
fallback. Choose demo books on Day 4 that actually rank first.

---

### R7 — Agent writes do not appear in the UI
**Likelihood: medium · Impact: severe (to the video)**

If tools bypass the store, the agent's changes only appear on reload. The entire
visual payoff — books landing on the shelf as the agent works — disappears.

**Mitigation:** architectural. Tools call `store.*`, never `localStorage` or
React state ([05](05-architecture.md)). Verify by watching the screen during
every Inspector call on Day 3.

---

### R8 — Prompt injection via catalog data
**Likelihood: low in practice · Impact: reputational, and a scored opportunity**

Open Library is a public wiki. A book record edited to contain instructions flows
into the agent's context through `search_catalog`.

**Mitigation:** `untrustedContentHint: true` on that tool, and never
concatenating catalog strings into anything that reads as an instruction.
This is worth *raising* rather than hiding — it is concrete evidence of
implementation depth for the "WebMCP Leverage" criterion.

---

### R9 — Scope creep past Monday
**Likelihood: high · Impact: moderate**

Series tracking, page counts, reading streaks, social features — all tempting,
none scored.

**Mitigation:** the cut list in [06](06-roadmap.md), agreed in advance. Anything
not in [03](03-product-spec.md) is out until after submission.

---

### R10 — Spec moves under us
**Likelihood: low over five days · Impact: variable**

WebMCP is a live draft; the API changed shape between the August 2025 proposal
and the shipping implementations.

**Mitigation:** the adapter isolates every host assumption in one file. Re-check
Chrome and ChatGPT docs on Wednesday morning before the final deploy.

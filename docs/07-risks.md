# 07 — Risk Register

Ordered by expected damage. The top four could lose the submission outright.

---

### R1 — Judges open the URL and see no tools
**Impact: fatal · Status: closed**

The `document.modelContext` vs `navigator.modelContext` divergence
([02](02-webmcp-reference.md)) means registering against the wrong namespace
produces an app with zero agent capability and no error message.

**Mitigation:** the adapter shim, supporting both namespaces and both
registration styles, plus a visible ready/unsupported status in the header so
the failure is loud rather than silent.

**Status:** the first seven tools registered and were callable live in ChatGPT's
in-app browser. Chrome has not been separately re-checked, but it shares the
code path. `navigate_to` was added afterwards and should be confirmed during the
rehearsal, against the deployed URL rather than localhost.

---

### R2 — Cold-start demo has no data
**Impact: fatal to the headline journey · Status: closed**

A judge with empty `localStorage` asks "what should I read next?" and
`get_taste_profile` truthfully answers "not enough history". The flagship
journey produces nothing for the one person who matters.

**Mitigation:** 80 books seeded on first visit with deliberate taste signal
([05](05-architecture.md)). Recovery is a documented `localStorage` deletion
rather than a button — a control that wipes the reader's list does not belong in
a reading list, and an accidental click on camera would be worse than the
problem it solves.

---

### R3 — The submission is incomplete at the deadline
**Impact: fatal · Status: open — the video is the critical path**

Four mandatory artefacts. The two most commonly forgotten are the open-source
licence file and the video being **public rather than unlisted**, and YouTube
processing on a large upload can take longer than you have.

**Mitigation:** submit Wednesday, buffer Thursday ([06](06-roadmap.md)). The MIT
licence landed on day one, not day five. Check the video in a private window.

---

### R4 — Output budget overruns corrupt agent behaviour
**Impact: severe · Status: mitigated, never observed**

1,500 characters is easy to exceed — Open Library returns 2,838 bytes for two
books. Overrun means truncation mid-row, a malformed table, and an agent that
misreads the data without knowing it did.

**Mitigation:** pipe-delimited rows instead of JSON, `limit` defaulting to 10,
field projection at the API call, and a `budget()` guard that truncates at a row
boundary with an explicit marker. Never truncate silently.

**Status:** the largest measured output is 732 characters, less than half the
budget, so the guard has never actually fired.

---

### R5 — `requestUserInteraction` is unsupported in ChatGPT's browser
**Impact: moderate · Status: open, and unmeasured rather than unresolved**

It appears in the W3C proposal and Chrome's docs; ChatGPT's site-tools page does
not mention it. If unavailable, the human-in-the-loop beat does not run natively
on the primary judging surface.

**Mitigation:** code defensively — `agent?.requestUserInteraction?.()`, proceed
on `undefined`, block only on an explicit `false` — so the tool never hard-fails.
The fallback is the app's own dialog, which is the same one the reader's delete
button opens.

**Status:** `remove_book` worked end to end in the ChatGPT browser, but *which*
branch ran was never logged, so this is unmeasured rather than closed. Confirm
before recording: the video should describe the path that is actually live, not
the one we would prefer. A console log in each branch settles it in a minute.

---

### R6 — Open Library returns the wrong book on camera
**Impact: moderate · Status: accepted, mitigated**

Verified: searching "the dispossessed" ranks *The Lathe of Heaven* second. During
a live demo, an agent adding the wrong book looks like a broken product.

**Mitigation:** return year and author on every row so both agent and human can
disambiguate; keep `limit` at 10 so the right answer is in range; rehearse with
the exact queries used on video; keep the manual add path visible as a fallback.
Choose demo books that rank first.

---

### R7 — Agent writes do not appear in the UI
**Impact: severe, to the video · Status: closed architecturally**

If tools bypassed the store, an agent's changes would only appear on reload, and
the entire visual payoff disappears.

**Mitigation:** structural rather than procedural. Tools call `store.*`, never
`localStorage` or React state ([05](05-architecture.md)), and the store is
consumed through `useSyncExternalStore` so external writes re-render the tree.

---

### R8 — Prompt injection via catalog data
**Impact: reputational, and a scored opportunity · Status: mitigated**

Open Library is a public wiki. A record edited to contain instructions flows into
the agent's context through `search_catalog`.

**Mitigation:** `untrustedContentHint: true` on that tool, and a hard rule that
no next-step guidance line ever interpolates catalogue text
([04](04-tool-design.md)). Worth *raising* rather than hiding — it is concrete
evidence of implementation depth.

---

### R9 — Scope creep
**Impact: moderate · Status: held**

Series tracking, page counts, reading streaks, social features — all tempting,
none scored.

**Mitigation:** the cut list in [06](06-roadmap.md), agreed in advance. Anything
not in [03](03-product-spec.md) waits until after submission.

---

### R10 — The spec moves underneath us
**Impact: variable · Status: low over five days**

WebMCP is a live draft; the API changed shape between the August 2025 proposal
and the shipping implementations.

**Mitigation:** the adapter isolates every host assumption in one file. Re-check
both sets of docs on Wednesday morning before the final deploy.

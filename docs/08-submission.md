# 08 — Submission Materials

The four mandatory artefacts ([01-hackathon-brief.md](01-hackathon-brief.md)),
drafted here and finalised on Day 5.

The narration and submission copy below are written in the entrant's voice and
are intended to be delivered as written. The surrounding notes are direction.

---

## 1. Demo video

Under 3:00, public on YouTube, with audio.

Judges watch many of these, and the opening fifteen seconds determine whether
the remainder is watched. The structure therefore leads with the result rather
than the setup, and excludes architecture diagrams and codebase tours.

### Shot list, 2:45 target

**0:00–0:15 · Opening.** Cold open on a full shelf of real covers.

> "This is my reading list. Forty-seven books read, twenty-four waiting. Picking
> the next one is genuinely hard — and it's exactly what an agent should be able
> to do, if the site would just tell it something useful."

**0:15–0:55 · A1, the primary journey.** In ChatGPT's in-app browser, ask "what
should I read next?". Show Site tools invoking `get_taste_profile`, then
`search_my_books`. The agent recommends with reasoning, naming both preferred
and abandoned authors, and the application opens that book on screen as the
answer arrives.

> "It didn't read two hundred rows to work that out. The site computed a taste
> profile and handed it over in under a thousand characters. And it didn't just
> name the book — it put it in front of me."

This segment carries the most weight in the submission and warrants the most
rehearsal.

**0:55–1:30 · A2, the multimodal journey.** Upload a photograph of a bookshelf.
The agent identifies titles, calls `search_catalog` and then `add_book`, and
books appear individually and live.

> "There's no vision code in this app at all. The agent brings the eyes; the site
> brings the catalogue and the shelf."

**1:30–1:55 · A3.** Describe a book without naming it: "the one where an
anthropologist from an anarchist moon visits the capitalist planet". The agent
web-searches, resolves and adds it.

**1:55–2:20 · Human-in-the-loop.** Ask the agent to remove a book. The
application interrupts and asks. Decline. The agent reports the declined result.

> "Destructive actions stop and ask. The agent proposes; the human decides."

Declining is more memorable than accepting, and demonstrates the safety model
rather than describing it.

**2:20–2:45 · Close.** Pan across the shelf, with one line on security.

> "Catalogue results are flagged as untrusted content — Open Library is a public
> wiki, so any record could carry an injection. Eight tools, no backend, MIT
> licensed."

### Production notes

- Record at a readable zoom; judges may view at 720p in a browser tab
- Show the Site tools panel at least once, as evidence the tools are real
- Deliver from bullets rather than reading prose verbatim
- Hard stop at 2:50; exceeding 3:00 risks disqualification
- Cold profile, seeded library, rehearsed queries ([07-risks.md](07-risks.md), R6)

---

## 2. Submission text

> ### TBR — a reading list that agents can actually reason about
>
> **The problem.** Reading lists are where books go to die. Mine has twenty-four
> books on it and I have read none of them this year, because "what should I read
> next?" is a question about *taste* — and answering it means holding sixty books,
> their ratings, and the ones I abandoned, all in my head at once.
>
> **Why WebMCP.** A general browser agent could scrape my list, but it would be
> reading a rendered page one screenful at a time, and WebMCP tool output is
> capped at 1,500 characters. Sixty books with ratings do not fit, and paging
> through them burns the agent's context on data it should never have had to
> parse.
>
> So TBR does the work instead. `get_taste_profile` aggregates the whole reading
> history *on the site* — favourite authors by mean rating, abandoned authors,
> era distribution, finishing rate — and returns it in about 700 characters with
> a computed signal line like *"has given up on Neal Stephenson more than once"*.
> The agent gets a hypothesis to reason from, not a data dump to wade through.
> **This is the core argument for WebMCP: the site knows its own data and can
> pre-compute exactly the summary an agent needs.**
>
> **Humans and agents together.** Photograph a bookshelf and the agent identifies
> the spines while the site resolves them against Open Library and files them —
> the agent brings vision, the site brings the catalogue. Describe a book you
> cannot name and the agent web-searches, then hands the title to the same tool.
> When the agent proposes deleting something, `requestUserInteraction()` stops
> execution and asks the reader directly — the agent proposes, the human decides,
> and the agent is told what the human chose. And because a recommendation you
> only *hear* is worse than one you can see, tools hand off to `navigate_to`, so
> the screen follows the conversation and the reader ends up looking at the book
> being discussed.
>
> **Implementation.** Eight imperative tools registered on the top-level page.
> Read tools carry `readOnlyHint`; `search_catalog` carries
> `untrustedContentHint`, because Open Library is a public wiki and any record
> could carry an injected instruction into the agent's context. Tools return
> pipe-delimited rows rather than JSON — roughly twice the books per character —
> with capped result counts that state what was withheld, and every error names
> the next tool to call rather than dead-ending. A registration adapter
> feature-detects `document.modelContext` and `navigator.modelContext`, so the
> tools work in both ChatGPT's browser and Chrome. No backend and no login: Open
> Library is called client-side and the library lives in `localStorage`.
>
> Open the live URL and ask it what to read next.

Approximately 420 words. The implementation paragraph is the first to trim
against a length limit.

---

## 3. Repository checklist

- [x] Public GitHub repository
- [x] `LICENSE`, MIT
- [x] `README.md` covering the product, the live URL, local setup, and WebMCP
      enablement in Chrome and ChatGPT
- [x] `docs/`, retained as evidence for the WebMCP Leverage and Ambition
      criteria
- [x] Tool registration code linked directly from the README
- [x] No secrets, there being no backend
- [x] Clean history with descriptive commit messages
- [ ] Video link added to the README on publication

## 4. Live URL checklist

- [x] HTTPS, publicly reachable, no login or interstitial
- [x] Ordinary browser: explicit unsupported state, application fully usable by
      hand
- [ ] Tested on a machine that has never run the dev server
- [ ] Tested with empty `localStorage`, confirming the seed library appears
- [ ] Tested in ChatGPT's in-app browser, confirming all eight tools under Site
      tools
- [ ] Tested in Chrome with `chrome://flags/#enable-webmcp-testing`

## 5. Devpost form

- [ ] Title: TBR — a reading list agents can reason about
- [ ] Live URL, repository link, public YouTube link verified in a private window
- [ ] Submission text above
- [ ] Screenshots: the shelf, the Site tools panel, the confirmation dialog
- [ ] Submitted Wednesday, edited Thursday if required

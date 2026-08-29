# 08 — Submission Materials

Four mandatory artefacts ([01](01-hackathon-brief.md)). Drafts below; finalise on
Day 5.

---

## 1. Demo video — under 3:00, public YouTube, with audio

Judges watch a lot of these. The first fifteen seconds decide whether they watch
the rest, so **lead with the payoff, not the setup**. No architecture diagrams,
no "let me first show you the codebase".

### Shot list (2:45 target)

**0:00–0:15 — The hook.** Cold open on a full, good-looking shelf of real covers.
> "This is my reading list. Sixty-one books read, twenty-four waiting. Picking
> the next one is genuinely hard — and it's exactly the kind of thing an agent
> should be able to do, if the site would just tell it something useful."

**0:15–0:55 — Journey A1, the flagship.** In ChatGPT's in-app browser, ask
*"what should I read next?"*. Show the Site tools panel firing
`get_taste_profile` and `search_my_books`. The agent recommends **with reasoning**
— naming loved authors and abandoned ones.
> "It didn't read two hundred rows to work that out. The site computed a taste
> profile and handed it over in under a thousand characters. That's the part
> generic browser agents can't do."

*This is the most important 40 seconds in the submission. Rehearse it most.*

**0:55–1:30 — Journey A2, the multimodal one.** Upload a photo of a real
bookshelf. The agent identifies titles, calls `search_catalog` then `add_book`,
and books appear on screen **one at a time, live**.
> "No vision code in this app at all. The agent brings the eyes; the site brings
> the catalog and the shelf."

**1:30–1:55 — Journey A3.** Describe a book you can't name — *"the one where an
anthropologist from an anarchist moon visits the capitalist planet"*. Agent
web-searches, resolves, adds.

**1:55–2:20 — The human-in-the-loop beat.** Ask the agent to remove a book. The
app interrupts with a confirmation. **Say no.** The agent reports back that the
reader declined.
> "Destructive actions stop and ask. The agent proposes; the human decides."

*Saying no is more memorable than saying yes, and it demonstrates the safety
model rather than describing it.*

**2:20–2:45 — Close.** Pan the shelf. One line on security.
> "Catalog results are flagged as untrusted content — Open Library is a public
> wiki, so any record could carry an injection. Seven tools, no backend, MIT
> licensed."

### Production notes
- Record the screen at a readable zoom — judges may watch at 720p in a browser tab
- Show the **Site tools** panel at least once; it is proof the tools are real
- Real voice over a script beats reading verbatim; write bullets, not prose
- **Hard-stop at 2:50.** Over 3:00 risks disqualification
- Cold-profile run, seeded library, rehearsed queries ([07](07-risks.md), R6)

---

## 2. Submission text

> ### TBR — a reading list that agents can actually reason about
>
> **The problem.** Reading lists are where books go to die. Mine has twenty-four
> books on it and I have read none of them this year, because "what should I read
> next?" is a question about *taste* — and answering it means holding sixty books,
> their ratings, and the ones I abandoned, all in your head at once.
>
> **Why WebMCP.** A general browser agent could scrape my list, but it would be
> reading a rendered page one screenful at a time, and WebMCP tool output is
> capped at 1,500 characters. Sixty books with ratings do not fit, and paging
> through them burns the agent's context on data it should never have had to
> parse.
>
> So TBR does the work instead. `get_taste_profile` aggregates the whole reading
> history *on the site* — favourite authors by mean rating, abandoned authors,
> era distribution, finishing rate — and returns it in under a thousand
> characters, with a computed one-line signal like *"rates literary and older
> speculative fiction highly; abandons long door-stopper series"*. The agent gets
> a hypothesis to reason from, not a data dump to wade through. **This is the
> core argument for WebMCP: the site knows its own data and can pre-compute
> exactly the summary an agent needs.**
>
> **Humans and agents together.** Three things TBR does that a scraping agent
> cannot. Photograph a bookshelf and the agent identifies the spines while the
> site resolves them against Open Library and files them — the agent brings
> vision, the site brings the catalog. Describe a book you cannot name and the
> agent web-searches, then hands the title to the same tool. And when the agent
> proposes deleting something, `requestUserInteraction()` stops execution and
> asks the reader directly — the agent proposes, the human decides, and the
> agent is told what the human chose.
>
> **Implementation.** Seven imperative tools registered on the top-level page.
> Read tools carry `readOnlyHint`; `search_catalog` carries
> `untrustedContentHint`, because Open Library is a public wiki and any record
> could carry an injected instruction into the agent's context. Every tool
> returns pipe-delimited rows rather than JSON — roughly twice the books per
> character — with capped result counts that state what was withheld, and every
> error names the next tool to call rather than dead-ending. A registration
> adapter feature-detects `document.modelContext` and `navigator.modelContext`
> so the tools work in both ChatGPT's browser and Chrome. No backend, no login:
> Open Library is called client-side and the library lives in `localStorage`.
>
> Open the live URL and ask it what to read next.

*(~380 words. Trim the implementation paragraph first if there is a limit.)*

---

## 3. Repository checklist

- [ ] Public GitHub repo
- [ ] **`LICENSE` — MIT.** Mandatory; add it on Day 2
- [ ] `README.md`: what it is, live URL, video link, how to run locally, **how to
      enable WebMCP** in Chrome and ChatGPT
- [ ] `docs/` — this folder. Planning depth is evidence for the
      "WebMCP Leverage" and "Ambition" criteria; leave it in
- [ ] Tool registration code obvious and findable — link directly to
      `src/webmcp/tools.ts` from the README
- [ ] No secrets (there should be none — no backend, no API keys)
- [ ] Clean history, real commit messages

---

## 4. Live URL checklist

- [ ] HTTPS, publicly reachable, no login or interstitial
- [ ] Tested on a machine that has never run the dev server
- [ ] Tested with empty `localStorage` → seed library appears
- [ ] Tested in ChatGPT's in-app browser → tools listed under **Site tools**
- [ ] Tested in Chrome with `chrome://flags/#enable-webmcp-testing`
- [ ] Tested in a plain browser → honest "agent features unavailable" banner,
      app still fully usable by hand

---

## Devpost form

- [ ] Title: **TBR — a reading list agents can reason about**
- [ ] Live URL
- [ ] Public YouTube link (verify in incognito)
- [ ] Repo link
- [ ] Submission text above
- [ ] Screenshots: the shelf, the Site tools panel, the confirmation dialog
- [ ] **Submit Wednesday.** Edit Thursday if needed.

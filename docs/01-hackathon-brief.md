# 01 — Hackathon Brief

Source: <https://webmcp.devpost.com>, fetched 29 August 2026.

## Deadline

**Thursday 3 September 2026, 1:00pm PDT.** Five days from the start, and the
last one is a half day. Every scope decision in these docs is downstream of that
number — see [06-roadmap.md](06-roadmap.md).

## Prizes

$35,000 across **ten winners**, roughly $3,500 each in combined cash and
credits from OpenAI, Vercel, Netlify, Chrome, Render, Shopify and Cloudflare.

The shape matters more than the amounts: it is a top-ten field, not a single
grand prize, and **no prize is tied to a hosting platform**. A narrow, polished
demo is a realistic target; breadth is not rewarded.

## Submission requirements

Four, all mandatory. Missing one is a disqualification, not a deduction.

- **A live URL** judges can open in ChatGPT's in-app browser or in Chrome with
  WebMCP enabled. Publicly reachable, no login wall.
- **A text description** covering why WebMCP fits, how the UX improves, what
  humans and agents do *together*, and the implementation approach.
  Drafted in [08](08-submission.md).
- **A demo video** under 3 minutes, public on YouTube, with audio.
- **A public repo** with full source, run instructions, an open-source licence
  file, and the tool registration code.

## Judging criteria

Four, equally weighted. How TBR answers each:

| Criterion | The answer |
|---|---|
| **WebMCP Leverage** | `get_taste_profile` computes on the site what the agent cannot afford to read; correct security annotations; `requestUserInteraction` on the destructive call; `navigate_to` so the screen follows the conversation. Not CRUD wrappers. |
| **Execution** | A complete reading list that stands on its own without an agent. |
| **Potential Impact** | Reading backlogs are a real and widely-felt problem, and the pattern — personal collection plus agent — generalises to any collection app. |
| **Creativity & Ambition** | Photograph a shelf and the books land in the list. Describe a book you can't name and it gets added. The taste profile turns a list into a recommendation. |

The rules ask for a "working, non-trivial implementation" enabling
collaboration "difficult or impossible before". A thin CRUD wrapper reads as
trivial; [04](04-tool-design.md) targets that criterion directly.

## Eligibility and hosting

UK entry is fine — the excluded regions are Belarus, Brazil, China, Crimea,
Cuba, Iran, North Korea, Russia, Syria, Venezuela, Hong Kong and Quebec.

Hosting must be ChatGPT Sites, Cloudflare, Vercel, Render, Netlify, Shopify
"or equivalent" — an open list. See [05](05-architecture.md) for why that lands
on Vercel.

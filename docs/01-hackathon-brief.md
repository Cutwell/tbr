# 01 — Hackathon Brief

Source: <https://webmcp.devpost.com>, fetched 29 August 2026.

## Deadline

Thursday 3 September 2026, 1:00pm PDT. Five days from the project start, the
last of them a half day. Every scope decision in this folder derives from that
constraint; see [06-roadmap.md](06-roadmap.md).

## Prizes

$35,000 distributed across ten winners, approximately $3,500 each in combined
cash and credits from OpenAI, Vercel, Netlify, Chrome, Render, Shopify and
Cloudflare.

The structure matters more than the amounts. It is a top-ten field rather than a
single grand prize, and no prize is tied to a hosting platform. A narrow,
well-executed demo is therefore a realistic target, and breadth carries no
reward.

## Submission requirements

Four artefacts, all mandatory. A missing artefact is a disqualification rather
than a deduction.

- **A live URL**, openable in ChatGPT's in-app browser or in Chrome with WebMCP
  enabled, publicly reachable and without a login wall.
- **A text description** covering the fit for WebMCP, the UX improvement, the
  collaboration between humans and agents, and the implementation approach.
  Drafted in [08](08-submission.md).
- **A demo video** under three minutes, public on YouTube, with audio.
- **A public repository** containing the source, run instructions, an
  open-source licence file, and the tool registration code.

## Judging criteria

Four criteria, equally weighted.

| Criterion | TBR's answer |
|---|---|
| **WebMCP Leverage** | `get_taste_profile` computes on the site what the agent cannot afford to read; security annotations reflect real properties of the data; `requestUserInteraction` gates the destructive call; `navigate_to` keeps the screen aligned with the conversation. |
| **Execution** | A complete reading list that functions without an agent present. |
| **Potential Impact** | Reading backlogs are a common problem, and the pattern of a personal collection paired with an agent generalises to any collection app. |
| **Creativity & Ambition** | A photographed shelf becomes list entries; a described book is identified and added; the taste profile turns a list into a recommendation. |

The rules require a "working, non-trivial implementation" enabling collaboration
"difficult or impossible before". A thin CRUD wrapper does not meet that bar.
[04-tool-design.md](04-tool-design.md) addresses this criterion directly.

## Eligibility and hosting

Entrants must be above the age of majority in their country of residence.
Excluded regions are Belarus, Brazil, China, Crimea, Cuba, Iran, North Korea,
Russia, Syria, Venezuela, Hong Kong and Quebec. A UK-based entry is eligible.

Hosting must be ChatGPT Sites, Cloudflare, Vercel, Render, Netlify, Shopify "or
equivalent", which is an open list rather than a closed set. See
[05-architecture.md](05-architecture.md) for the selection.

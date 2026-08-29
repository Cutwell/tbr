# 01 — Hackathon Brief

Source: <https://webmcp.devpost.com> (fetched 2026-08-29)

## Deadline

**Wednesday 3 September 2026, 1:00pm PDT.**

Today is Saturday 29 August 2026. That is **5 days**, and the last one is a half
day. Every scope decision in these docs is downstream of that number. See
[06-roadmap.md](06-roadmap.md).

## Prize structure

$35,000 total pool, **top 10 winners** at ~$3,500 each in combined value:

| Sponsor | Per winner |
|---|---|
| OpenAI | $3,000 cash + Codex Micro + ChatGPT Pro (1yr) + swag |
| Vercel | $4,200 credits (12 months) |
| Netlify | $500 cash |
| Google Chrome | 3-month AI Ultra sub per team member (~$300) |
| Render | $300 credits |
| Shopify | $250 gear |
| Cloudflare | $10,000 credits across the pool |

Top 10 of an open field is a realistic target for a well-executed, narrow demo.
It is not a "one grand prize" lottery — polish and a clear story matter more
than breadth.

## Submission requirements

All four are mandatory. Missing any one is a disqualification, not a deduction.

- [ ] **Working live URL** that judges can open in *ChatGPT's in-app browser* or
      *Chrome with WebMCP enabled*. Must be publicly reachable with no login
      wall — see the guest-mode note in [05](05-architecture.md).
- [ ] **Text description** covering: why WebMCP fits this use case; how the UX
      improves; what humans and agents can do *together*; and the implementation
      approach. Drafted in [08-submission.md](08-submission.md).
- [ ] **Demo video**, under 3 minutes, public YouTube link, **with audio**.
- [ ] **Public repo** (GitHub) with full source, assets, run instructions, an
      **open-source licence file**, and the WebMCP tool registration code.

## Judging criteria

Four equal-weight criteria. Mapped to what we are actually building:

| Criterion | How TBR scores |
|---|---|
| **WebMCP Leverage** | Depth of implementation. Our answer: `get_taste_profile` (site-computed reasoning aid), correct security annotations, `requestUserInteraction` on destructive calls, and state-aware tool re-registration. Not just CRUD wrappers. |
| **Execution** | A complete, working product — not a tool harness with no UI. The human app must be genuinely usable on its own. |
| **Potential Impact** | Reading backlogs are a real, widely-felt problem. The pattern (personal library + agent) generalises to any collection app. |
| **Creativity & Ambition** | The multimodal path (photograph a shelf → books land in the list) and the taste profile are the differentiators. Plain "add a book" is table stakes. |

The rules explicitly require "genuine effort and a working, non-trivial
implementation" enabling collaboration "difficult or impossible before". A thin
CRUD wrapper reads as trivial. Design notes in [04](04-tool-design.md) target
this directly.

## Eligibility

Must be above the age of majority in country of residence. Excluded regions
include Belarus, Brazil, China, Crimea, Cuba, Iran, North Korea, Russia, Syria,
Venezuela, Hong Kong, and **Quebec**. UK-based entry is fine.

## Deployment

Must be on a supported platform: ChatGPT Sites, Cloudflare, Vercel, Render,
Netlify, Shopify, or equivalent. Vercel and Netlify both carry prize credits;
either is a safe choice. See [05](05-architecture.md).

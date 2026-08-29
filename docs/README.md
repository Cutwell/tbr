# TBR — Documentation

**TBR** is a reading-list app built as a demo for the
[WebMCP Challenge](https://webmcp.devpost.com). It tracks books a user wants to
read, and exposes its functionality to AI agents as WebMCP tools so that an
agent can search the user's shelves, build a taste profile, and add books on
their behalf.

## Status

Planning. No code written yet. This folder is the plan.

## The one-line pitch

> Reading lists are where books go to die. TBR turns your backlog into something
> an agent can actually reason about — "what should I read next?" gets a real
> answer, because the site hands the agent a taste profile instead of a data dump.

## Read in this order

| Doc | What it covers |
|---|---|
| [01-hackathon-brief.md](01-hackathon-brief.md) | Deadline, prizes, judging criteria, submission checklist |
| [02-webmcp-reference.md](02-webmcp-reference.md) | Verified API surface, the namespace divergence, hard limits |
| [03-product-spec.md](03-product-spec.md) | User journeys, data model, screens |
| [04-tool-design.md](04-tool-design.md) | The WebMCP toolset — schemas, budgets, security hints |
| [05-architecture.md](05-architecture.md) | Stack, catalog choice, storage, deployment |
| [06-roadmap.md](06-roadmap.md) | Day-by-day plan to the deadline |
| [07-risks.md](07-risks.md) | Risk register and mitigations |
| [08-submission.md](08-submission.md) | Demo video script and submission copy |

## The three decisions that shape everything else

1. **Open Library is the catalog.** Verified `access-control-allow-origin: *`,
   no API key, no proxy, no server. See [05](05-architecture.md).
2. **Register against both API namespaces.** ChatGPT reads
   `document.modelContext`; the W3C proposal says `navigator.modelContext`. We
   shim both or judges see nothing. See [02](02-webmcp-reference.md).
3. **`get_taste_profile` is the centrepiece.** The site computes the profile so
   the agent doesn't have to read 200 rows through a 1.5K output budget. This is
   the thing that makes the submission score on "WebMCP Leverage".
   See [04](04-tool-design.md).

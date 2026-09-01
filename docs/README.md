# TBR — Documentation

**TBR** is a reading list that tracks what you want to read, what you finished,
and what you gave up on — and exposes all of it to AI agents as
[WebMCP](https://developer.chrome.com/docs/ai/webmcp) tools. Built for the
[WebMCP Challenge](https://webmcp.devpost.com).

This folder is the plan the app was built from, kept current as it shipped. The
README at the [repo root](../README.md) is the tour; this is the reasoning.

## The pitch

> Reading lists are where books go to die. TBR turns a backlog into something an
> agent can reason about — "what should I read next?" gets a real answer,
> because the site hands over a taste profile instead of a data dump.

## Read in this order

| Doc | What it covers |
|---|---|
| [01-hackathon-brief.md](01-hackathon-brief.md) | Deadline, prizes, judging criteria, submission requirements |
| [02-webmcp-reference.md](02-webmcp-reference.md) | Verified API surface, the namespace divergence, hard limits |
| [03-product-spec.md](03-product-spec.md) | User journeys, data model, screens |
| [04-tool-design.md](04-tool-design.md) | The eight tools — schemas, output budgets, security hints |
| [05-architecture.md](05-architecture.md) | Stack, catalog, storage, performance, deployment |
| [06-roadmap.md](06-roadmap.md) | The five-day plan, and what actually landed |
| [07-risks.md](07-risks.md) | Risk register and mitigations |
| [08-submission.md](08-submission.md) | Demo script and submission copy |

## The three decisions everything else follows from

1. **Open Library is the catalog.** `access-control-allow-origin: *`, no API
   key — so no proxy, and therefore no backend. See [05](05-architecture.md).
2. **Register against both API namespaces.** ChatGPT reads
   `document.modelContext`; the W3C proposal says `navigator.modelContext`. An
   adapter shims both, or judges open the app and see nothing.
   See [02](02-webmcp-reference.md).
3. **`get_taste_profile` is the centrepiece.** The site computes the profile so
   the agent doesn't have to read 80 rows through a 1,500-character budget.
   See [04](04-tool-design.md).

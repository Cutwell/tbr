# TBR — Documentation

TBR is a reading list that tracks books a reader wants to read, has finished, or
has abandoned, and exposes that library to AI agents as
[WebMCP](https://developer.chrome.com/docs/ai/webmcp) tools. It was built for the
[WebMCP Challenge](https://webmcp.devpost.com).

This folder documents the shipped product. The
[repository README](../README.md) is the short tour; the reading order below
provides the evidence behind its design and implementation claims.

## Premise

Reading lists accumulate faster than they are read. "What should I read next?"
is a question about taste, and answering it requires weighing an entire reading
history at once. TBR computes that history into a profile an agent can consume
in a single call, rather than exposing rows for the agent to page through.

## Recommended reading order

| Document | Contents |
|---|---|
| [webmcp-reference.md](webmcp-reference.md) | Verified API surface, the namespace divergence, hard limits |
| [product-spec.md](product-spec.md) | Shipped human and agent journeys, data model, screens |
| [tool-design.md](tool-design.md) | The seven tools: schemas, output budgets, security hints |
| [architecture.md](architecture.md) | Stack, catalogue, storage, performance, deployment |
| [verification.md](verification.md) | Reproducible build and tool verification |

Contributor workflow is documented separately in
[contributing.md](contributing.md).

## Founding decisions

Three decisions constrain everything else in this folder.

1. **Open Library is the catalogue.** It sends
   `access-control-allow-origin: *` and requires no API key, which removes the
   need for a proxy and therefore for a backend. See
   [architecture](architecture.md).
2. **Registration targets both API namespaces.** ChatGPT reads
   `document.modelContext`; the W3C proposal specifies
   `navigator.modelContext`. An adapter shims both, since registering against
   the wrong one produces an app with no tools and no error. See
   [webmcp-reference](webmcp-reference.md).
3. **`get_taste_profile` is the centrepiece.** The site aggregates the reading
   history so the agent does not have to read 80 rows through a
   1,500-character budget. See [tool-design](tool-design.md).

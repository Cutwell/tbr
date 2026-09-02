# TBR

A reading list that you and an AI agent can use together. Track books you want
to read, have finished, or gave up on; TBR exposes the same library to agents
through [WebMCP](https://developer.chrome.com/docs/ai/webmcp).

[Try the live demo](https://project-tbr.vercel.app) · Built for the [WebMCP Challenge](https://webmcp.devpost.com) · Watch demo video on [YouTube](https://youtu.be/7HRfz-xouaQ)

## Why WebMCP fits

TBR knows your books, ratings, shelves, and reading history. An agent brings
reasoning, conversation, web search, and vision. WebMCP gives the agent a small,
typed set of actions for working with TBR instead of making it scrape the page
or guess how the interface works.

The site also does the work it knows best. Rather than sending an entire reading
history to the agent, `get_taste_profile` turns it into a compact summary of
favourite authors, reading eras, completion rates, and patterns in abandoned
books. The agent can spend its context making a recommendation, not reconstructing
the library.

## What you can do together

- Ask what to read next. The agent can compare your taste profile with your TBR
  shelf, explain its choice, and open the book it recommends.
- Show the agent a photo of a bookshelf, or describe a title you cannot
  remember. It can identify the books, match them through Open Library, and add
  them to your shelf.
- Ask it to find, rate, move, or remove books. Changes appear in the interface
  immediately, and removal still requires your confirmation.

You can also use TBR entirely by hand: search Open Library, import a Goodreads
CSV, manage your shelves, and view your taste profile. Agent activity is shown
with toasts and highlights so it is always clear what changed.

## Development

See [DEVELOPER.md](DEVELOPER.md) for local setup, WebMCP testing, and the code
guide.

## Licence

[MIT](LICENSE)

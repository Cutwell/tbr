# Developing TBR

TBR is a static Next.js 16 app built with React 19, TypeScript, and Tailwind CSS.
Open Library supplies catalogue data, and each reading list is stored in the
browser's `localStorage`; there is no account or backend.

## Run locally

```bash
npm install
npm run dev
```

Agent features require ChatGPT's in-app browser or Chrome with WebMCP enabled.
The reading list remains fully usable in other browsers.

For a production build and local static server:

```bash
npm run build
npx serve out
```

## WebMCP tools

TBR registers seven tools: `search_catalog`, `search_my_books`,
`get_taste_profile`, `add_book`, `update_book`, `remove_book`, and
`navigate_to`.

WebMCP tools call the same store as the UI—they never write to React state or
`localStorage` directly. This keeps agent changes and the visible interface in
sync.

## Further reading

- [Documentation index](docs/README.md)
- [Architecture](docs/architecture.md)
- [WebMCP tool design](docs/tool-design.md)
- [Verification](docs/verification.md)
- [Contributing](docs/contributing.md)

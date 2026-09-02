# Verification

TBR keeps its automated acceptance gate in `Taskfile.yml`. From a clean checkout:

```bash
npm ci
task verify
```

## Automated checks

| Check | What it establishes |
|---|---|
| `npm run lint` | Source satisfies the Next.js Core Web Vitals and TypeScript ESLint rules. |
| `npx tsc --noEmit` | The strict TypeScript project type-checks without emitting files. |
| `npm run build` | Next.js produces the static application in `out/`. |
| `task verify:tools` | All seven public tool names occur in the production bundle. |

The bundle check covers `search_catalog`, `search_my_books`,
`get_taste_profile`, `add_book`, `update_book`, `remove_book`, and
`navigate_to`. It catches a tool accidentally omitted from the exported set;
descriptor budgets are also asserted by `auditToolDescriptors()` during
development start-up.

## Runtime checks

`task verify:live` follows redirects from the configured production URL and
requires an HTTP 200 response, HTTPS, and a final URL on the same origin. The
application registers tools from its top-level app shell and exposes the same
set as `window.__tbrTools` in development for direct exercise.

Behavioral review covers the empty first-run state, demo-library loading,
catalogue search and caching, shelf mutations, confirmation before removal,
and visible UI updates after tool-originated writes. Host-native interaction is
not required for deletion safety: when `requestUserInteraction` is unavailable
or rejects, `remove_book` awaits the application's confirmation dialog instead.

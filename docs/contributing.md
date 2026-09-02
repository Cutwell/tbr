# Contributing

## Before opening a change

Create a focused branch from the current default branch. Keep unrelated refactors separate, preserve the atoms → molecules → organisms → templates component hierarchy, and read the relevant architecture or tool-design document before changing those areas.

Install dependencies with `npm ci`. During development, run `task check`; before requesting review, run the complete local gate:

```bash
task verify
```

This lints and type-checks the source, creates the static export, and confirms that all registered WebMCP tools survive bundling. No automated browser test suite or coverage threshold is configured, so manually exercise affected routes. WebMCP changes must also be checked in a capable browser for registration, expected annotations, visible store updates, and confirmation of destructive actions.

## Commits

Use Conventional Commit-style subjects:

```text
feat: add shelf sorting
fix(webmcp): preserve tool annotations
docs: clarify deployment checks
feat(webmcp)!: remove a public tool
```

Use an imperative, lower-case summary after the type, keep each commit focused, and add a scope when it improves clarity. Common types are `feat`, `fix`, `docs`, `chore`, and `refactor`. Mark breaking behavior with `!` and explain its impact in the commit body.

## Pull requests

Open a pull request only when it is reviewable and `task verify` passes. Complete the repository template: describe the user-visible result and motivation, link issues with `Closes #123` where applicable, identify affected routes or WebMCP tools, and record both automated and manual verification. Add before/after screenshots for UI changes.

Call out changes involving persistence, external catalogue data, tool schemas or annotations, destructive behavior, and `requestUserInteraction`. Do not merge until review comments are resolved and the required `Lint` and `Verify` checks pass. Prefer squash-merging unless preserving a deliberate sequence of commits helps explain the change; the resulting commit must still follow the convention above.


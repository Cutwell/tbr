# Repository Guidelines

## Project Structure & Module Organization

TBR is a static Next.js 16 App Router application. Routes and styles live in `src/app/`; reusable UI follows an atoms → molecules → organisms → templates hierarchy under `src/components/`. In `src/lib/`, `store/` owns state and persistence, `catalog/` integrates with Open Library, `webmcp/` registers agent tools, and `utils/` contains shared helpers. Architecture decisions are documented in `docs/`. Builds are emitted to `out/`.

The central architectural rule is that WebMCP tools never write to React state or `localStorage` directly. They must call the same store in `src/lib/store/store.ts` that the UI uses, ensuring agent-originated changes trigger UI updates.

## Build, Test, and Development Commands

- `npm install`: install the locked dependency set.
- `npm run dev`: start the local Next.js development server.
- `npm run lint`: run ESLint with Next.js Core Web Vitals and TypeScript rules.
- `npx tsc --noEmit`: type-check without producing files.
- `npm run build`: create the static export in `out/`.
- `task check`: run linting and type-checking together.
- `task verify`: run all pre-flight checks, including a fresh build and tool bundle verification.
- `task serve`: build and serve `out/` locally; `next start` is not appropriate for this static export.

## Coding Style & Naming Conventions

Write strict TypeScript and functional React components. Follow the existing two-space indentation, semicolons, double quotes, and trailing commas. Use PascalCase for component files and exports (`BookCard.tsx`), camelCase for functions and modules (`shelfDate.ts`), and the `@/` alias for imports from `src/`. Keep pages responsible for data orchestration and reusable components free of application state. Before changing Next.js APIs, consult the installed version’s guidance in `node_modules/next/dist/docs/`.

## Testing Guidelines

No test framework or coverage threshold is configured. Treat `task verify` as the minimum acceptance gate. Manually exercise changed pages and, for WebMCP work, confirm tool registration and visible store updates in a capable browser. If adding tests, colocate them as `*.test.ts` or `*.test.tsx` and add the runner command to `package.json`.

## Commit & Pull Request Guidelines

Follow the canonical policy in `docs/09-contributing.md`. Use focused Conventional Commits such as `feat:`, `fix(webmcp):`, or `docs:`; append `!` for breaking behavior. Before requesting review, run `task verify` and manually exercise affected routes. Complete `.github/pull_request_template.md`, link relevant issues, and include before/after screenshots for UI work. Explicitly call out persistence, external data, tool schema or annotation, confirmation, and destructive-action changes. Pull requests require resolved review comments and passing `Lint` and `Verify` checks.

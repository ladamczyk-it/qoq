# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (what the tool checks, monorepo support, Node LTS reference) lives in `AGENTS.md` — that file is shipped with the npm package so any agent in a consumer project can read it from `node_modules/@ladamczyk/check-engine/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./bin)
npm run build

# Build and run locally
npm run dev

# Run tests
npm test
```

## Internal architecture

Two helpers in `src/helpers/`:

- **`fetchNodeInfo(path)`** — fetches `https://nodejs.org/download/release/index.json` to derive the two highest active LTS major versions. Falls back to reading a local `node.json` snapshot when the network is unavailable. Returns `{ currentLts, maintainedLts }`.
- **`checkEngine(path, workspaces)`** — reads one `package.json`, collects `engines.node` from every dependency (or devDependency if dependencies is empty), then validates the package's own `engines.node` against that set using semver range intersection. Exits with code `1` on mismatch or invalid range.

`src/index.ts` resolves the list of `package.json` files to check: the root `package.json` is always included; workspace glob patterns are expanded by reading the filesystem via `readdirSync`. Both helpers are called once per resolved path.

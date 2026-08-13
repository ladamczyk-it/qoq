# CLAUDE.md

Consumer-facing context (what the tool checks, monorepo support, Node LTS reference) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./bin
npm run dev   # Build and run locally
npm test      # from the repo root — no per-package test script
```

## Internal architecture

Two helpers in `src/helpers/`:

- **`fetchNodeInfo(path)`** — fetches `https://nodejs.org/download/release/index.json` to derive the two highest active LTS major versions. Falls back to reading a local `node.json` snapshot when the network is unavailable. Returns `{ currentLts, maintainedLts }`.
- **`checkEngine(path, workspaces)`** — reads one `package.json`, collects `engines.node` from every dependency (or devDependency if dependencies is empty), then validates the package's own `engines.node` against that set using semver range intersection. Exits with code `1` on mismatch or invalid range.

`src/index.ts` resolves the list of `package.json` files to check: the root `package.json` is always included; workspace glob patterns are expanded by reading the filesystem via `readdirSync`. Both helpers are called once per resolved path.

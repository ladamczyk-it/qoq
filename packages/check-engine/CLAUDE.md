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

- **`checkEngine(path)`** — pure: reads one `package.json`, collects `engines.node` from every dependency (or devDependency if dependencies is empty), and returns a `WorkspaceResult`. It never exits or writes.
- **`formatHuman(results)`** — pure: renders the results as one line per workspace.

`src/index.ts` resolves the list of `package.json` files to check: the root `package.json` is always included; workspace glob patterns are expanded by reading the filesystem via `readdirSync`. `checkEngine` runs once per resolved path, the report goes to stderr, and `process.exitCode` is set to `1` once if any result failed (`process.exit` is never called).

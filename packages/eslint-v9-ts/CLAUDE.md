# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, naming conventions, added plugins) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-ts/AGENTS.md`.

## Commands

```bash
# Build (Rolldown → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` defines the package's deltas as flat-config layers (`tsLayer` — TypeScript parser, `@typescript-eslint` rule sets, import-x TS adjustments, naming conventions; `testLayer` — test-file relaxations of `tsLayer`'s unsafe-type rules; `strictLayer` — opt-in strictness rules from typescript-eslint's `strict` family) and exports `configs.base` / `configs.test` / `configs.strict`, the `defineConfig` array forms (JS base → `tsLayer` [→ `testLayer` | `strictLayer`]), merged per file by ESLint's own cascade instead of being pre-merged.

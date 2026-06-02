# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, plugins, key rules) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-js/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

- **`src/index.ts`** — exports `baseConfig`, `EslintConfig`/`EslintConfigPlugin` types, and `getNoRestrictedImportsPaths()`. The base config is assembled at import time by composing rules from all plugins.
- **`src/tools.ts`** — exports `executeInspector()`, used by the `bin` entry to generate ESLint stats files (consumed by tests in other packages via `npm run config-inspector` at the root).

This is the root of the ESLint inheritance chain. All other `eslint-v9-*` packages extend `baseConfig` from here.

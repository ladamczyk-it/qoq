# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, plugins, key rules) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-js/AGENTS.md`.

## Commands

```bash
# Build (Rolldown → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

- **`src/index.ts`** — exports `baseConfig`, the root delta layer of the whole `eslint-v9-*` chain (assembled at import time by composing rules from all plugins), plus `configs.base` (`baseConfig` wrapped in a `defineConfig` array for `defineConfig`/`extends`-style composition), the `EslintConfig`/`EslintConfigPlugin` types, and `getNoRestrictedImportsPaths()`.
- **`src/tools.ts`** — exports `executeInspector()`, used by the `bin` entry to generate ESLint stats files (consumed by tests in other packages via `npm run config-inspector` at the root).
- **`src/stats.ts`** (exported as `@ladamczyk/qoq-eslint-v9-js/stats`) — parses the `structured-clone` payload that `@eslint/config-inspector build` writes under a package's `stats/__rpc-dump/` and exposes `getEnabledRuleNames()` / `getEnabledDeprecatedRules()`. Every `eslint-v9-*` package's `src/stats.spec.ts` imports these to assert it enables no deprecated rules.

This is the root of the ESLint inheritance chain. Every other `eslint-v9-*` package composes `baseConfig` — this package's own delta layer — directly into its own `configs.*` chain, and never by nesting another package's already-composed `configs.*`: `defineConfig` doesn't dedupe diamond extends, so a nested `configs.*` would re-apply `baseConfig` mid-chain and clobber earlier layers' sonarjs rule restorations.

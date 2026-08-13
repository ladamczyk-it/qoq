# CLAUDE.md

Consumer-facing context (exports, plugins, key rules) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./lib CJS+ESM + ./bin inspector
npm test      # from the repo root — no per-package test script
```

## Internal architecture

- **`src/index.ts`** — exports `baseConfig`, `EslintConfig`/`EslintConfigPlugin` types, and `getNoRestrictedImportsPaths()`. The base config is assembled at import time by composing rules from all plugins.
- **`src/tools.ts`** — exports `executeInspector()`, used by the `bin` entry to generate ESLint stats files (consumed by tests in other packages via `npm run config-inspector` at the root).
- **`src/stats.ts`** (exported as `@ladamczyk/qoq-eslint-v9-js/stats`) — parses the `structured-clone` payload that `@eslint/config-inspector build` writes under a package's `stats/__rpc-dump/` and exposes `getEnabledRuleNames()` / `getEnabledDeprecatedRules()`. Every `eslint-v9-*` package's `src/stats.spec.ts` imports these to assert it enables no deprecated rules.

This is the root of the ESLint inheritance chain. All other `eslint-v9-*` packages extend `baseConfig` from here.

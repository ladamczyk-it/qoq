# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, plugins, disabled rules) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-js-jest/AGENTS.md`.

## Commands

```bash
# Build (Rolldown → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` exports `jestLayer` — only this package's own delta on top of the JS base (Jest plugin + globals, restored test-lifecycle sonarjs rules, jest-specific extras, and `disabledRules`, re-exported so `eslint-v9-ts-jest` can apply the same relaxations without duplicating them) — and `configs.base`, the `defineConfig` array form of the full chain (JS base → `jestLayer` → a JS-only layer disabling `sonarjs/no-incompatible-assertion-types`, a hard no-op without a typed-linting parser), merged per file by ESLint's own cascade.

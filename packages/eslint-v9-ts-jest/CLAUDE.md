# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (inheritance, exports) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-ts-jest/AGENTS.md`.

## Commands

```bash
# Build (Rolldown → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` exports `tsJestLayer` — only this package's own delta on top of the composed chain (empty rules; it just names the config node, since layer composition means the jest layer's restorations and the ts layers' relaxations are never re-applied here) — and `configs.base`, the `defineConfig` array form of the full chain (JS base → jest layer → ts layer → ts test relaxations → `tsJestLayer`), merged per file by ESLint's own cascade. The JS-only `sonarjs/no-incompatible-assertion-types` disable that `eslint-v9-js-jest` appends to its own `configs.base` is deliberately absent here — this package has type information, so that rule stays enabled.

Composed from delta layers only — never from another package's own `configs.*`: `defineConfig` doesn't dedupe diamond extends, so nesting one would re-apply the JS base mid-chain and clobber earlier layers' sonarjs rule restorations.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (inheritance, exports) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-ts-react/AGENTS.md`.

## Commands

```bash
# Build (Rolldown → ./lib ESM-only + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` exports `tsReactLayer` — only this package's own delta on top of the composed chain (`@eslint-react/recommended-typescript` rules only; layer composition means `reactLayer`'s restorations and its `@eslint-react/no-multi-comp` enable are never clobbered, so neither needs to be re-applied here) — and `configs.base`, the `defineConfig` array form of the full chain (JS base → React layer → ts layer → `tsReactLayer`), merged per file by ESLint's own cascade. `testLayer` is deliberately absent from this chain: this bundle is the base delta chain only, not the test-file relaxations.

Composed from delta layers only — never from another package's own `configs.*`: `defineConfig` doesn't dedupe diamond extends, so nesting one would re-apply the JS base mid-chain and clobber `reactLayer`'s sonarjs restorations.

The custom `@eslint-react/no-multi-comp` rule's implementation lives entirely in `eslint-v9-js-react`'s `reactLayer`; this package only inherits it.

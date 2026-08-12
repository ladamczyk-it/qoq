# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (inheritance, exports) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-ts-vitest/AGENTS.md`.

## Commands

```bash
# Build (Rolldown → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` exports `tsVitestLayer` — only this package's own delta on top of the composed chain (just the vitest typecheck setting; layer composition means the vitest layer's restorations are never clobbered, so nothing else is left to add) — and `configs.base`, the `defineConfig` array form of the full chain (JS base → vitest layer → ts layer → ts test relaxations → `tsVitestLayer`), merged per file by ESLint's own cascade. The JS-only vitest relaxations from `eslint-v9-js-vitest` are deliberately absent — they don't apply under typed linting.

Composed from delta layers only — never from another package's own `configs.*`: `defineConfig` doesn't dedupe diamond extends, so nesting one would re-apply the JS base mid-chain and clobber the vitest layer's rule restorations.

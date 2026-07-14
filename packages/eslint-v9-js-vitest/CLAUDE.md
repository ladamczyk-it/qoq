# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, plugins, disabled rules) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-js-vitest/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` exports `baseConfig` (extends JS base with `@vitest/eslint-plugin` + globals) and `disabledRules` (re-exported so `eslint-v9-ts-vitest` can apply the same relaxations). The delta lives in `vitestLayer` — shared with `eslint-v9-ts-vitest`'s `defineConfig` chain, so JS-only relaxations (`jsOnlyDisabledRules`) stay out of it and are composed in separately by both `baseConfig` and `configs.base`. `src/configs.spec.ts` asserts both export shapes resolve identically.

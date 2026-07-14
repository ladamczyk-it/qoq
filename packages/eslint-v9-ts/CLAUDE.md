# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, naming conventions, added plugins) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-ts/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` defines the package's deltas as flat-config layers (`tsLayer`, `testLayer`, `strictLayer`) and derives both export shapes from them: the legacy pre-merged objects (`baseConfig`/`testConfig`/`strictConfig`, built with `objectMergeRight` over the JS base config, plugins spread separately because ESLint flat config requires plugins at the top level) and the `configs.*` `defineConfig` arrays, which let ESLint's own cascade do the merging. `src/configs.spec.ts` asserts both shapes resolve to the same effective config via `calculateConfigForFile`. `testConfig` is a shallow relaxation of `baseConfig` that disables the most disruptive TypeScript unsafe rules for test files.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, naming conventions, added plugins) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@saashub/qoq-eslint-v9-ts/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` exports `baseConfig` and `testConfig`. Both are built with `objectMergeRight` over the JS base config. The plugins object is constructed separately (spread pattern) because ESLint flat config requires plugins at the top level, not nested inside merges. `testConfig` is a shallow relaxation of `baseConfig` that disables the four most disruptive TypeScript unsafe rules for test files.

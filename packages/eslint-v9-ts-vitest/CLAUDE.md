# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (inheritance, exports) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-ts-vitest/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

Mirrors `eslint-v9-ts-jest`: merges JS-Vitest base, import-x rule reset, and TS `testConfig`. Uses `disabledRules` from `eslint-v9-js-vitest`.

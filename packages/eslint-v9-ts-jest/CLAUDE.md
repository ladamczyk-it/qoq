# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (inheritance, exports) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@saashub/qoq-eslint-v9-ts-jest/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` merges JS-Jest base, an import-x rule reset, and TS `testConfig` using the same three-way merge pattern as `eslint-v9-ts-react`. Uses `disabledRules` from `eslint-v9-js-jest`.

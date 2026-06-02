# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (inheritance, exports) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-ts-react/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` merges three configs in order: JS-React base, import-x rule reset (to avoid duplicate import rules), and TS base — then applies `@eslint-react/recommended-typescript` rules on top. The plugins object is assembled by spreading both parent plugin maps.

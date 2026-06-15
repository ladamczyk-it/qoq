# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (inheritance, exports) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-ts-react/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib ESM-only + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` merges three configs in order: JS-React base, import-x rule reset (to avoid duplicate import rules), and TS base — then applies `@eslint-react/recommended-typescript` rules on top. The plugins object is assembled by spreading both parent plugin maps (so the `@eslint-react` plugin already carries the custom `no-multi-comp` rule registered by JS-React).

The custom `@eslint-react/no-multi-comp` rule is re-asserted in the final `rules` block (referenced via the imported `NO_MULTI_COMP_RULE_NAME`) so the `recommended-typescript` spread can't drop it. Its implementation lives entirely in `eslint-v9-js-react`; this package only enables it.

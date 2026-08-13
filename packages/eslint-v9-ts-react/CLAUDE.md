# CLAUDE.md

Consumer-facing context (inheritance, exports) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./lib ESM-only + ./bin inspector
npm test      # from the repo root — no per-package test script
```

## Internal architecture

`src/index.ts` merges three configs in order: JS-React base, import-x rule reset (to avoid duplicate import rules), and TS base — then applies `@eslint-react/recommended-typescript` rules on top. The plugins object is assembled by spreading both parent plugin maps (so the `@eslint-react` plugin already carries the custom `no-multi-comp` rule registered by JS-React).

The custom `@eslint-react/no-multi-comp` rule is re-asserted in the final `rules` block (referenced via the imported `NO_MULTI_COMP_RULE_NAME`) so the `recommended-typescript` spread can't drop it. Its implementation lives entirely in `eslint-v9-js-react`; this package only enables it.

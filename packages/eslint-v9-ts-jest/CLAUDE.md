# CLAUDE.md

Consumer-facing context (inheritance, exports) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./lib CJS+ESM + ./bin inspector
npm test      # from the repo root — no per-package test script
```

## Internal architecture

`src/index.ts` merges JS-Jest base, an import-x rule reset, and TS `testConfig` using the same three-way merge pattern as `eslint-v9-ts-react`. Uses `disabledRules` from `eslint-v9-js-jest`.

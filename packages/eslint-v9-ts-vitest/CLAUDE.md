# CLAUDE.md

Consumer-facing context (inheritance, exports) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./lib CJS+ESM + ./bin inspector
npm test      # from the repo root — no per-package test script
```

## Internal architecture

Mirrors `eslint-v9-ts-jest`: merges JS-Vitest base, import-x rule reset, and TS `testConfig`. Uses `disabledRules` from `eslint-v9-js-vitest`.

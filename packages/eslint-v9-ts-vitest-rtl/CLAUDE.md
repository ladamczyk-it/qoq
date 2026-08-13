# CLAUDE.md

Consumer-facing context (inheritance, exports) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./lib CJS+ESM + ./bin inspector
npm test      # from the repo root — no per-package test script
```

## Internal architecture

Extends TS-Vitest base with `eslint-plugin-testing-library` (`flat/react`). Mirrors `eslint-v9-ts-jest-rtl` with the Vitest base instead.

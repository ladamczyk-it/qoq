# CLAUDE.md

Consumer-facing context (inheritance, exports) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./lib CJS+ESM + ./bin inspector
npm test      # from the repo root — no per-package test script
```

## Internal architecture

Extends TS-Jest base with `eslint-plugin-testing-library` (`flat/react`). Follows the same plugin-spread pattern as the JS RTL variant.

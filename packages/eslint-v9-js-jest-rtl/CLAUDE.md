# CLAUDE.md

Consumer-facing context (inheritance, exports) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./lib CJS+ESM + ./bin inspector
npm test      # from the repo root — no per-package test script
```

## Internal architecture

`src/index.ts` merges JS-Jest base with `eslint-plugin-testing-library`'s `flat/react` config. Both plugin maps are spread into the top-level `plugins` object.

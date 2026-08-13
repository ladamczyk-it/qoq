# CLAUDE.md

Consumer-facing context (exports, plugins, disabled rules) lives in `AGENTS.md`.

## Commands

```bash
npm run build # Rolldown → ./lib CJS+ESM + ./bin inspector
npm test      # from the repo root — no per-package test script
```

## Internal architecture

`src/index.ts` exports `baseConfig` (extends JS base with `@vitest/eslint-plugin` + globals) and `disabledRules` (re-exported so `eslint-v9-ts-vitest` can apply the same relaxations).

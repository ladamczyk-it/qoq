# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, plugins, disabled rules) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@saashub/qoq-eslint-v9-js-vitest/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` exports `baseConfig` (extends JS base with `@vitest/eslint-plugin` + globals) and `disabledRules` (re-exported so `eslint-v9-ts-vitest` can apply the same relaxations).

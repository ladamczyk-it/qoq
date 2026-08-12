# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, plugins, disabled rules) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-eslint-v9-js-vitest/AGENTS.md`.

## Commands

```bash
# Build (Rolldown → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` exports `vitestLayer` — only this package's own delta on top of the JS base (`@vitest/eslint-plugin` + globals, restored test-lifecycle sonarjs rules, vitest-specific extras, and `disabledRules`, re-exported so `eslint-v9-ts-vitest` can apply the same relaxations) — and `configs.base`, the `defineConfig` array form of the full chain (JS base → `vitestLayer` → a JS-only layer disabling `sonarjs/no-incompatible-assertion-types`), merged per file by ESLint's own cascade. `vitestLayer` deliberately excludes the JS-only relaxations so `eslint-v9-ts-vitest` can compose it directly without inheriting a disable that doesn't apply once type information is available.

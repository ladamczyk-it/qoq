# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, plugins, import order rule) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@saashub/qoq-eslint-v9-js-react/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` builds `baseConfig` and `disabledRules` (exported for reuse by `eslint-v9-ts-react`). The import order rule and no-restricted-imports rule are patched versions of the JS base rules — they are reconstructed by spreading the original rule config and adding React-specific entries.

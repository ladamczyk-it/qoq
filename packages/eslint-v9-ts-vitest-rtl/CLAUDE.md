# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (inheritance, exports) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@saashub/qoq-eslint-v9-ts-vitest-rtl/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib CJS+ESM + ./bin inspector)
npm run build

# Run tests
npm test
```

## Internal architecture

Extends TS-Vitest base with `eslint-plugin-testing-library` (`flat/react`). Mirrors `eslint-v9-ts-jest-rtl` with the Vitest base instead.

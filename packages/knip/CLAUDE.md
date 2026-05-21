# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exports, pre-built configs) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@saashub/qoq-knip/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib)
npm run build

# Run tests
npm test
```

## Internal architecture

Two source files:

- **`src/knipConfig.ts`** — `getKnipConfig()` factory that assembles a plain Knip config object from its parameters, all with defaults
- **`src/index.ts`** — re-exports `getKnipConfig` and calls it four times to produce the `jsConfig`, `jsReactConfig`, `tsConfig`, and `tsReactConfig` convenience exports

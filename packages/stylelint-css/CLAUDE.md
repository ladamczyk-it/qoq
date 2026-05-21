# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exported config, plugins) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@saashub/qoq-stylelint-css/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib)
npm run build

# Run tests
npm test
```

## Internal architecture

Single source file `src/index.ts` that exports `baseConfig` — a plain Stylelint config object composed from `extends` (standard + clean-order + prettier) and three plugins (file-max-lines, high-performance-animation, no-unsupported-browser-features). No runtime logic; the object is assembled at import time.

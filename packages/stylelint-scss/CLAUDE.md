# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (exported config, inheritance) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@saashub/qoq-stylelint-scss/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./lib)
npm run build

# Run tests
npm test
```

## Internal architecture

Single source file `src/index.ts`. Spreads `@saashub/qoq-stylelint-css`'s `baseConfig`, overrides `extends` to use `stylelint-config-standard-scss`, and adds an SCSS-specific `overrides` entry that suppresses the `css-nesting` unsupported-feature warning.

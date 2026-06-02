# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (config values) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-prettier-with-json-sort/AGENTS.md`.

## Commands

```bash
# Run tests
npm test
```

## Internal architecture

Config-only package: `index.json` extends the base prettier config with `prettier-plugin-sort-json`. No build step required.

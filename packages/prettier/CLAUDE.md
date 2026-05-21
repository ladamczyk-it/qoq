# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (config values) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@saashub/qoq-prettier/AGENTS.md`.

## Commands

```bash
# Run tests
npm test
```

## Internal architecture

Config-only package: `index.json` holds the Prettier preset, `src/index.js` re-exports it for programmatic use. No build step required.

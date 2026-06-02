# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (config values) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@ladamczyk/qoq-jscpd/AGENTS.md`.

## Commands

```bash
# Run tests
npm test
```

## Internal architecture

This package is config-only: a single `index.json` file containing the JSCPD preset. No build step. Consumed directly by `KnipExecutor` in `@ladamczyk/qoq-cli`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Consumer-facing context (CLI flags, scoring categories, skills directory layout) lives in `AGENTS.md` — shipped with the npm package at `node_modules/@saashub/skillslint/AGENTS.md`.

## Commands

```bash
# Build (Rollup → ./bin)
npm run build

# Run tests
npm test
```

## Internal architecture

`src/index.ts` runs two sequential checks:

1. **textlint** — invoked via `executeCommand` with the bundled `.textlintrc.json`; catches prose issues (misspellings, passive voice)
2. **agent-skills-cli** — `assessQuality()` scores each skill subdirectory across five dimensions; any skill below its threshold sets `exitCode = ERROR`

The exit code from textlint is preserved; if `--fix` is passed and textlint exits with ERROR, the process reports the failure and continues to the scoring step. Final exit is determined by the worst of both checks.

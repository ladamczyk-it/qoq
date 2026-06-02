# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**QoQ (Quality over Quantity)** is a monorepo of npm packages published under `@ladamczyk/qoq-*` that orchestrate Prettier, ESLint, Knip, JSCPD, Stylelint, and Skillslint via a single CLI. Node >=22.15.0 is required.

## Commands

```bash
# Install dependencies
npm install

# Build all packages (via Lerna)
npm run build

# Run tests (runs config-inspector first, then vitest across all packages)
npm test

# Quality checks (used in CI and pre-push)
npm run qoq:check   # full check
npm run qoq:fix     # auto-fix
```

## Monorepo Layout

- `packages/cli` — the `qoq` CLI binary; main orchestrator
- `packages/utils` — shared utilities used across packages
- `packages/check-engine` — node version enforcement
- `packages/eslint-v9-*` — ESLint flat config templates (JS/TS × framework × test runner)
- `packages/prettier[-with-json-sort]` — Prettier config templates
- `packages/knip` — Knip config template
- `packages/jscpd` — JSCPD config template
- `packages/stylelint-{css,scss}` — Stylelint config templates
- `packages/skillslint` — textlint-based skill documentation linter
- `apps/website` — Docusaurus documentation site

## Testing

Tests live in `packages/*/src/**/*.spec.{ts,js}` and run with Vitest across all packages.

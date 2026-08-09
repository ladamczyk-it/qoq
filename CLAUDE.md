# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**QoQ (Quality over Quantity)** is a monorepo of npm packages published under `@ladamczyk/qoq-*` that orchestrate Prettier, ESLint, Knip, JSCPD, Stylelint, Structurelint, Skillslint, and npm-outdated checks via a single CLI (the latter two are backed by the separate `@ladamczyk/skillslint` and `@ladamczyk/structurelint` packages, not part of this workspace). Node >=22.15.0 is required.

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

## Testing

Tests live in `packages/*/src/**/*.spec.{ts,js}` and run with Vitest across all packages.

## The `qoq` skill and its diagrams

The skill lives at `skills/qoq/` — `SKILL.md` routes, `references/*.md` hold each
command's rules, `agents/*.md` are the five subagents. Its Mermaid workflow
diagrams live **outside** the skill, at `docs/qoq-workflows.md`, so an agent
reading the skill never spends context on a picture it can't act on.

**Changing either one means changing the other, in the same commit.** The diagram
and the prose are two renderings of one workflow:

- Edit a command's prose in `skills/qoq/` → update the matching diagram in
  `docs/qoq-workflows.md`.
- Edit a diagram → update the reference file it maps to. Its header table says
  which one.

The prose is what an agent actually executes, so it wins on a disagreement — but
a stale diagram is worse than no diagram, because it's the thing a person reaches
for when they want to understand a flow quickly and they have no reason to doubt
it. Neither direction is "just documentation": a change that only lands on one
side isn't finished.

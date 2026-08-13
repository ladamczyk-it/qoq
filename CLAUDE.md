# CLAUDE.md

## Project Overview

**QoQ (Quality over Quantity)** — a monorepo of npm packages published as
`@ladamczyk/qoq-*`, orchestrating Prettier, ESLint, Knip, JSCPD, Stylelint,
Structurelint, Skillslint and npm-outdated behind one CLI. Node >=22.15.0.

Structurelint and Skillslint are the separate `@ladamczyk/structurelint` and
`@ladamczyk/skillslint` packages — not in this workspace.

## Commands

| Command             | Notes                                                   |
| ------------------- | ------------------------------------------------------- |
| `npm install`       |                                                         |
| `npm run build`     | all packages, via Lerna                                 |
| `npm test`          | config-inspector first, then vitest across all packages |
| `npm test Name`     | to run specific test                                    |
| `npm run qoq:check` | full quality check — this is what CI and pre-push run   |
| `npm run qoq:fix`   | auto-fix                                                |

## Monorepo Layout

- `packages/cli` — the `qoq` CLI binary; main orchestrator
- `packages/utils` — shared utilities
- `packages/check-engine` — node version enforcement
- `packages/eslint-v9-*` — ESLint flat config templates (JS/TS × framework × test runner). Each package exports its own delta layer plus `configs.*` `defineConfig` arrays composed from its ancestry, so ESLint's own per-file cascade does the merging instead of a pre-merge step
- `packages/prettier[-with-json-sort]` — Prettier config templates
- `packages/knip` — Knip config template
- `packages/jscpd` — JSCPD config template
- `packages/stylelint-{css,scss}` — Stylelint config templates

## Testing

`packages/*/src/**/*.spec.{ts,js}`, Vitest across all packages.

`npm run config:diff` compares what ESLint actually resolves (via `calculateConfigForFile`)
for every `eslint-v9-*` package against a git ref, defaulting to `master` — it checks the ref
out to a temporary worktree, builds it there, and diffs the result against the current
checkout. It's on-demand, not part of the gate: it isn't wired into `qoq:check` or
`husky:pre-push` because installing and building a second checkout takes minutes.

## The `qoq` skill and its diagrams

The skill is `skills/qoq/` — `SKILL.md` routes, `references/*.md` hold each
command's rules, `agents/*.md` are the five subagents. Its Mermaid diagrams live
**outside** it, at `docs/qoq-workflows.md`, so an agent reading the skill never
spends context on a picture it can't act on.

**Both change in the same commit, both directions.** Prose in `skills/qoq/` →
update the matching diagram in `docs/qoq-workflows.md`. A diagram → update the
reference file its header table names.

Prose wins on a disagreement. But a stale diagram is worse than none: it's what
a person reaches for, and they have no reason to doubt it. Landing on one side
only isn't finished.

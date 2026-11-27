---
sidebar_position: 5
title: The qoq skill | v4.x
sidebar_label: The qoq skill | v4.x
description: 'The qoq Claude Code skill in 4.x (skill 1.0–1.1): review, refactor, fix, bump packages and gate, seven quality dimensions, every change a reviewable git patch. | v4.x'
---

4.x is where QoQ's [Claude Code](https://claude.com/claude-code) skills start. The rule they follow: a few high-confidence, intention-revealing changes over a long list of nitpicks, each staged as a reviewable git patch behind the project's own lint/test/build gate.

## Versions

The skill was versioned on its own (`metadata.version` in `SKILL.md`), and so was its plugin:

| Packages | Skill | `qoq` plugin | What changed                                                                       |
| -------- | ----- | ------------ | ---------------------------------------------------------------------------------- |
| 4.1.0    | —     | 1.0.0        | `npm-bump-packages` skill                                                          |
| 4.2.0    | —     | 1.0.0        | `qoq-code-review` and `qoq-code-refactor` skills                                   |
| 4.3.1    | 1.0.0 | 1.0.0        | The three fold into one `qoq` skill: `review`, `refactor`, `bump packages`, `gate` |
| 4.3.6    | 1.0.0 | 1.1.1        | `fix` joins it                                                                     |
| 4.5.0    | 1.1.0 | 1.1.1        | Structurelint in the engine                                                        |

## Installation

```text
/plugin marketplace add ladamczyk-it/qoq
/plugin install qoq@qoq-agent-skills
```

Or with a skills installer:

```bash
npx skills add ladamczyk-it/qoq --skill qoq
npx -p agent-skills-cli agent-skills add ladamczyk-it/qoq@qoq -a claude
```

## Commands

| Command         | What it does                                                                       |
| --------------- | ---------------------------------------------------------------------------------- |
| `review`        | Reviews a branch against its merge-base and stages each finding as a patch         |
| `refactor`      | The same analysis over a scope you choose; large scopes split into disjoint slices |
| `fix`           | Runs `qoq --check` over the project or a scope and stages every finding as a patch |
| `bump packages` | Minor/patch updates first, then majors one at a time with changelog research       |
| `gate`          | Non-interactive check of freshly written code; returns `PASS` or `FAIL`            |

Run `/qoq <command> [target]`, or describe the task: "is this ready to merge?" routes to `review`, "our deps are stale" to `bump packages`.

## The seven dimensions

`review` defines quality once; `refactor`, `fix` and `gate` reuse it. Each dimension yields at most one patch.

| Dimension          | What it looks for                                                  | Patch                |
| ------------------ | ------------------------------------------------------------------ | -------------------- |
| Spelling & naming  | Typos, intention-revealing names, no single-letter variables       | `spellings.patch`    |
| Dependencies       | Unused dependencies and exports, runtime vs dev placement          | `dependencies.patch` |
| Complexity / SOLID | Cognitive complexity a small restructuring genuinely reduces       | `complexity.patch`   |
| Copy-paste         | Near-duplicate logic worth one honest abstraction                  | `copy_paste.patch`   |
| Code conventions   | Arrow functions over `function`, named exports over default        | `conventions.patch`  |
| Design patterns    | Smells a standard pattern resolves without adding complexity       | `patterns.patch`     |
| TypeScript idioms  | Syntax for the real `tsconfig` target, immutable methods, no `any` | `typescript.patch`   |

Naming and complexity come from ESLint, dead code from Knip, duplication from JSCPD and formatting from Prettier; the rest are judged directly by the `qoq-analyzer` agent.

## How changes land

- Everything is staged under `.qoq/` as `git apply`-able patches without touching the working tree, then applied one at a time after sign-off, with the gate re-run after each.
- A fully successful run deletes `.qoq/`; an aborted run leaves it as the record of what's left.
- `gate` is the exception: it expects a dirty tree, auto-applies only safe fixes, and reports judgement calls (dead-code deletion, de-duplication, pattern changes) as advisories. `fix` stages both tiers as patches instead.

Other skills end with "run `/qoq gate <files you changed>` and declare done only on `PASS`".

Next: 5.x adds the `testing-gate` and `planning-gate` skills, then replaces `review` and `gate` with `plan`, `execute`, `test` and `compress`.

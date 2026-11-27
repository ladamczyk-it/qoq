---
sidebar_position: 5
title: The qoq skill | v5.x
sidebar_label: The qoq skill | v5.x
description: 'The qoq Claude Code skill in 5.x: from skill 1.x with review and gate, through testing-gate and planning-gate, to the 2.0 plugin with fix, refactor, bump, plan, execute, test and compress. | v5.x'
---

The `qoq` [Claude Code](https://claude.com/claude-code) skill applies the QoQ standard to a JavaScript/TypeScript repo, with the CLI as its gate. 5.x is where it grows from a review tool into a planning and delivery loop.

## Installation

```text
/plugin marketplace add ladamczyk-it/qoq
/plugin install qoq@qoq-agent-skills
```

Or `npx skills add ladamczyk-it/qoq --skill qoq`. The plugin bundles every skill in the repository.

## Versions

Each skill carried its own `metadata.version` until 5.3.2:

| Packages | `qoq` skill | Other skills          | `qoq` plugin | What changed                                                        |
| -------- | ----------- | --------------------- | ------------ | ------------------------------------------------------------------- |
| 5.0.0    | 1.1.0       | —                     | 1.1.1        | The 4.x skill: `review`, `refactor`, `fix`, `bump packages`, `gate` |
| 5.1.1    | 1.3.0       | —                     | 1.1.1        | Reworked skill                                                      |
| 5.2.1    | 1.3.1       | `testing-gate` 0.1.0  | 1.1.1        | Test writing, gated by `/qoq gate`                                  |
| 5.2.3    | 1.4.0       | `planning-gate` 0.1.0 | 1.1.1        | Planning; `review`/`refactor` delegate two lenses to other skills   |
| 5.3.1    | 1.4.0       | `planning-gate` 0.5.0 | 1.1.1        | `testing-gate` 0.2.0 since 5.2.5                                    |
| 5.3.2    | —           | —                     | 2.0.0        | Skill v2: one `qoq` skill, seven commands                           |

## `testing-gate` (5.2.1–5.3.1)

Wrote unit and integration tests for NestJS APIs and React components on Vitest or Jest, with React Testing Library and MSW. It read the runner, globals and run commands from the repo, stated whether it would write unit or integration tests before writing any, ran the new tests then the full suite, and was done only when `/qoq gate` returned `PASS`. A project-root `testing-gate.md` overrode its conventions.

## `planning-gate` (5.2.3–5.3.1)

Turned a spec or rough requirements into a milestone/ticket plan for a cost-tiered subagent orchestrator: every ticket t-shirt sized, rated for complexity so the cheapest capable model gets it, self-contained enough to pick up cold, and gated by `/qoq gate` (plus `testing-gate` for test-only tickets).

## Review lenses (5.2.3–5.3.1)

`review` and `refactor` handed two lenses to other skills: minimalism and over-engineering to `ponytail-review` (`minimalism.patch`, applied last), and design patterns and architecture to `design-pattern-review` (`patterns.patch`). A missing lens was reported and skipped, never a failure. `fix` and `gate` kept all seven built-in dimensions.

## 5.3.2: skill v2

| Command    | What it does                                               |
| ---------- | ---------------------------------------------------------- |
| `fix`      | Check/fix loop over tool findings, ends on PASS/FAIL       |
| `refactor` | Green base, then four judgement assessments over a scope   |
| `bump`     | Analyse dependencies, pick, then apply one patch at a time |
| `plan`     | Requirements → an approved plan file under `./plans/`      |
| `execute`  | An approved plan file → delivered milestones, under TDD    |
| `test`     | Unit/integration coverage for code that already exists     |
| `compress` | Strips agent-facing markdown to what an agent acts on      |

`testing-gate` becomes `test`, `planning-gate` becomes `plan` and `execute`, and `review` and `gate` are dropped. All seven commands share one project discovery record. Five agents do the work, each on a fixed model tier except the developer:

| Agent           | Model          | Job                                      |
| --------------- | -------------- | ---------------------------------------- |
| `qoq-discovery` | Haiku          | Derives and repairs the discovery record |
| `qoq-checker`   | Haiku          | Runs the tools, returns the digest       |
| `qoq-bumper`    | Sonnet         | Reads one package's changelog            |
| `qoq-developer` | Set per ticket | Delivers one ticket under TDD            |
| `qoq-tester`    | Sonnet         | Writes the specs for one slice           |

Next: 6.x adds `replan`, `document`, `mermaid`, `sheriff` and `review`, and the plugin version follows the packages.

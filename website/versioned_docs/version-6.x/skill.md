---
sidebar_position: 5
title: The qoq skill | v6.x
sidebar_label: The qoq skill | v6.x
description: 'The qoq Claude Code skill in 6.x: fix, refactor, bump, plan, replan, execute, test, compress, document, mermaid, sheriff and review, gated by the QoQ CLI. | v6.x'
---

The CLI is a gate. The `qoq` [Claude Code](https://claude.com/claude-code) skill is a guarded delivery loop on top of it: every step must clear the CLI's verdict, read from its `--json` reports, so nothing lands that the CLI rejects.

```text
/plugin marketplace add ladamczyk-it/qoq
/plugin install qoq@qoq-agent-skills
```

The plugin was 2.1.0 at 6.0.0; from **6.1.0** its version tracks the packages in lockstep. It also installs with `npx skills add ladamczyk-it/qoq --skill qoq`.

## Commands

| Command    | What it does                                                 | Added |
| ---------- | ------------------------------------------------------------ | ----- |
| `fix`      | Check/fix loop over tool findings, ends on PASS/FAIL         | 4.x   |
| `refactor` | Green base, then four judgement assessments over a scope     | 4.x   |
| `bump`     | Analyse dependencies, then apply one attributable patch each | 4.x   |
| `plan`     | Requirements → an approved plan under `./plans/`             | 5.x   |
| `execute`  | An approved plan → delivered milestones, ticket by ticket    | 5.x   |
| `test`     | Unit/integration coverage for code that already exists       | 5.x   |
| `compress` | Strips agent-facing markdown to what an agent acts on        | 5.3.2 |
| `replan`   | Reshapes an existing plan; delivered work stays frozen       | 6.1.4 |
| `document` | Experimental: the why, as JSDoc and agent-owned `./docs`     | 6.6   |
| `mermaid`  | A parse-validated Mermaid chart, printed or written to a doc | 6.6   |
| `sheriff`  | Security judgement on a change: injection, auth, secrets     | 6.7   |
| `review`   | A delivery or pull request judged against its plan           | 6.7   |

## What 6.x added

- **6.1** — `qoq-designer`, an agent mapping code smells to design patterns for `refactor`, and a self-learning estimate in `plan`. **6.1.3** adds the execute limit flags (`--session-limit`, `--weekly-limit`).
- **6.4** — typed hand-backs from `qoq-developer` and `qoq-tester`; a plan blocker asks the user instead of escalating.
- **6.5** — a progress board during `qoq execute`, also shown as a band above the prompt by the plugin's hook. `bump` validates against a check baseline and plans transitive fixes from the lockfile.
- **6.6** — `qoq-scribe` behind `document`, `qoq-artist` behind `mermaid`. Tracker export (Jira, Linear, Trello) is switched per project.
- **6.7** — `qoq-sheriff` behind `sheriff`, `qoq-reviewer` behind `review`.
- **6.8** — the digest reads `justify-disable-report.json`.

## Agents

`qoq-architect`, `qoq-artist`, `qoq-bumper`, `qoq-checker`, `qoq-designer`, `qoq-developer`, `qoq-reviewer`, `qoq-scribe`, `qoq-sheriff`, `qoq-test-reviewer` and `qoq-tester` — each dispatched by one command, at the model tier the skill assigns.

## Flags and targets

| Flag or target                    | Command                     | What it does                                                      |
| --------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `--decisions auto`                | `refactor`                  | Unattended: apply the mechanical tier, return the rest as advice  |
| `--session-limit <pct>`           | `execute`                   | Stop before spending past that share of the 5-hour limit          |
| `--weekly-limit <pct>`            | `execute`                   | The same for the 7-day limit; both default to `100`               |
| `--tool <tracker>`                | `plan`                      | `local`, `jira`, `linear` or `trello`: raise the approved tickets |
| `--source <tracker>`              | `execute`                   | Import a milestone from that tracker, then run it                 |
| `--docs`, `--sheriff`, `--review` | `execute`                   | Document, security-sweep or review each milestone                 |
| `--scan`                          | `bump`                      | Also plan fixes for `qoq scan` vulnerabilities                    |
| `--diagrams`                      | `plan`, `replan`, `execute` | Chart the plan before approval, and each milestone's docs         |
| `--to <path[#anchor]>`            | `mermaid`                   | Write the chart into a doc instead of printing it                 |
| `main..HEAD`, paths or a PR link  | `sheriff`                   | Sweep a range, a snapshot of paths, or any repo's pull request    |
| A PR link                         | `review`                    | Judge any repo's pull request against its description             |

## Experimental switches

`/qoq execute --docs`, `--sheriff` and `--review`, `/qoq bump --scan`, `/qoq plan --diagrams` and `--tool jira|linear|trello` each have a `future.unstable_skill_*` switch in `qoq.config.js`. See [Configuration](./configuration.md#general).

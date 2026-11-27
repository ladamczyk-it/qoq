---
sidebar_position: 6
title: Release notes | v6.x
sidebar_label: Release notes | v6.x
description: 'What each QoQ 6.x release added, from the 6.0 defineConfig ESLint presets to qoq scan, @ladamczyk/outdated, Justify-disable and the qoq skill commands. | v6.x'
---

Feature releases only; patch releases were dependency bumps and fixes. Full history: [`CHANGELOG.md`](https://github.com/ladamczyk-it/qoq/blob/v6.8.2/CHANGELOG.md).

## 6.8.0 — 2026-10-30

- Justify-disable check: `justifyDisable` config block, `--skip-justify-disable`, wizard prompt, file provider and `justify-disable-report.json` digest in the skill.

## 6.7.0 — 2026-10-28

- `/qoq review`: `qoq-reviewer` judges a delivery against its plan.
- `/qoq sheriff`: `qoq-sheriff` sweeps delivered diffs for security problems.

## 6.6.0 — 2026-10-27

- `/qoq mermaid`: `qoq-artist` draws parse-validated Mermaid charts.
- `/qoq document`: `qoq-scribe` writes the why as JSDoc and `./docs`.
- Tracker export and import sit behind per-project `future` switches.

## 6.5.0 — 2026-10-26

- `scan-report.json` findings gain `dev` and `via`.
- A `qoq execute` progress board, shown in the reply and as a plugin band above the prompt.
- `/qoq bump` validates against a pre-patch baseline, plans from `qoq scan`, and targets `latestInMajor` for minor/patch and transitive fixes.

## 6.4.0 — 2026-10-21

- Typed hand-back blocks for `qoq-developer` and `qoq-tester`; `blocker_kind` on the developer hand-back.
- 6.4.1: `qoq staged` scoped correctly for lint-staged; the CLI advertises the skill (`hints`).

## 6.3.0 — 2026-10-15

- `qoq scan`: vulnerability scan of `package-lock.json` with the default OSV.dev adapter, `ScanExecutor` timeout/status/exit policy and public adapter types.

## 6.2.0 — 2026-10-08

- The npm check switches to `@ladamczyk/outdated`.
- `check-engine`: `--include`, `--json`, `--quiet`, LTS advisory with `--no-lts`, every workspace reported in one exit.
- Minimum Node raised to `^22.22.2 || ^24.15.0 || >=26.0.0`, npm `>=10`.

## 6.1.0 — 2026-08-18

- `qoq-designer` agent for design-pattern suggestions; skill and marketplace version sync.
- Self-learning estimate in `/qoq plan`.
- 6.1.4: `/qoq replan`. 6.1.6: `qoq.config.ts` support, Knip skipped in an execute ticket's scope.

## 6.0.0 — 2026-08-15

- **Breaking:** ESLint presets export `configs.base` flat-config arrays and delta layers; `baseConfig`, `testConfig` and `strictConfig` are removed. See [Packages](./packages.md#what-changed-in-60).
- **Breaking:** the generated ESLint config is composed with `defineConfig`; presets that only export `baseConfig` no longer work with this CLI.
- **Breaking:** 21 `testing-library/*` rules become active in the RTL presets.
- Opt-in usage statistics.
- `objectMergeRight` deprecated.

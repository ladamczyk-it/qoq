---
sidebar_position: 6
title: Release notes | v5.x
sidebar_label: Release notes | v5.x
description: 'What each QoQ 5.x release added, from JavaScript API execution and CI mode to Knip ignore options, Rolldown builds and the qoq skill v2. | v5.x'
---

Feature releases and notable fixes. Full history: [`CHANGELOG.md`](https://github.com/ladamczyk-it/qoq/blob/v5.3.2/CHANGELOG.md).

## 5.3.0 — 2026-08-05

- Packages built with Rolldown; TypeScript 7 where possible.
- 5.3.1: `--warmup` never launches the wizard; Prettier cache dropped.
- 5.3.2: qoq skill v2 with the `compress` command, and a skill linter.

## 5.2.0 — 2026-07-15

- Knip `ignoreFiles`, `ignoreMembers` and `ignoreUnresolved`.
- 5.2.1: `testing-gate` skill. 5.2.3: `planning-gate` skill.

## 5.1.0 — 2026-07-14

- With `CI=true`, the ESLint config drops Prettier rules that only serve IDE previews.
- Reconfigured `qoq-eslint-v9-js` and `qoq-eslint-v9-ts`; `import-x` tuned for non-monorepo projects and `sonarjs` rules revised; `strictConfig` in `qoq-eslint-v9-ts`.
- 5.1.1: Prettier cache back, `npm outdated --json`, reworked qoq skill.

## 5.0.0 — 2026-07-08

- **Breaking:** ESLint, Prettier, Stylelint and JSCPD run through their JavaScript APIs, separated from CLI execution.
- Progress output for ESLint, Prettier and Stylelint; unified execution-time measurement.
- `CI=true` support.
- `qoq-eslint-v9-ts-react-structure` removed.
- 5.0.1: `configType` override.

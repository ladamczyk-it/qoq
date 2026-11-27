---
sidebar_position: 6
title: Release notes | v4.x
sidebar_label: Release notes | v4.x
description: 'What each QoQ 4.x release added, from the @saashub to @ladamczyk rename to Skillslint, the React structure preset, config self-check and Structurelint. | v4.x'
---

Feature releases and notable fixes. Full history: [`CHANGELOG.md`](https://github.com/ladamczyk-it/qoq/blob/v4.5.2/CHANGELOG.md).

## 4.5.0 — 2026-07-01

- Structurelint as an optional check.
- 4.5.2: Structurelint rules read from `qoq.config.js` instead of a separate file.

## 4.4.0 — 2026-06-30

- Config self-check: warns about entries that repeat a default or a template's ESLint rule.

## 4.3.0 — 2026-06-15

- React structure validation: `qoq-eslint-v9-ts-react-structure`.
- A custom `no-multi-comp` rule and `react-refresh/only-export-components` in the React presets.
- Skillslint check.
- 4.3.1: skills consolidated into one `qoq` skill. 4.3.2: CJS/ESM detection from `package.json` `type`. 4.3.6: `qoq fix` reworked; Skillslint runs through its JavaScript API.

## 4.2.0 — 2026-06-06

- `qoq-code-review` and `qoq-code-refactor` skills.
- 4.2.1: QoQ logo; skill metadata versioning.

## 4.1.0 — 2026-06-05

- `npm-bump-packages` skill.
- A Dockerfile to build the ESLint Config Inspector previews.

## 4.0.0 — 2026-06-02

- **Breaking:** packages renamed from `@saashub/qoq-*` to `@ladamczyk/qoq-*`; repository moved to `ladamczyk-it/qoq`.

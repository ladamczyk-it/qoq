---
sidebar_position: 4
title: Packages
description: Each @ladamczyk/qoq-* package — the CLI, ESLint presets, formatters, and analyzers.
---

# Packages

All packages live under the `@ladamczyk/*` namespace and are versioned together.

## `qoq-cli`

The command-line entry point. Handles formatting, linting, and testing of your JS/TS code by orchestrating every other package through the `--check`, `staged`, and `--fix` commands. Includes the Config Wizard, config handlers, and the executors that run each underlying tool. Monorepo-aware via `package.json` `workspaces`.

## `qoq-eslint-v9-*`

Opinionated [Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files) presets that bundle every plugin and setting needed for a given stack. Each exports both CommonJS and ESM and can be used as-is or as a base for your own rules.

Since **v6.0.0** every preset exports a `configs` object of ready-made flat-config **arrays** (`configs.base`, plus `configs.test` and `configs.strict` on `qoq-eslint-v9-ts`) instead of a pre-merged default export. Each preset also exports its own **delta layer** — `jsLayer`, `tsLayer`, `reactLayer`, `jestLayer`, … — which is what the stack presets compose with `defineConfig`, and what you compose yourself if you want a chain no shipped preset covers.

Every preset ships with a prebuilt [ESLint Config Inspector](https://github.com/eslint/config-inspector) so you can browse exactly which rules, plugins, and settings it enables — before you install it. Pick the variant that matches your language and test setup to open its dedicated page under [**ESLint Presets**](/docs/category/eslint-presets):

| Package                                  | Stack                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `@ladamczyk/qoq-eslint-v9-js`            | [JavaScript](./presets/eslint-v9-js.mdx)                                             |
| `@ladamczyk/qoq-eslint-v9-js-react`      | [JavaScript + React](./presets/eslint-v9-js-react.mdx)                               |
| `@ladamczyk/qoq-eslint-v9-js-jest`       | [JavaScript + Jest](./presets/eslint-v9-js-jest.mdx)                                 |
| `@ladamczyk/qoq-eslint-v9-js-jest-rtl`   | [JavaScript + Jest + React Testing Library](./presets/eslint-v9-js-jest-rtl.mdx)     |
| `@ladamczyk/qoq-eslint-v9-js-vitest`     | [JavaScript + Vitest](./presets/eslint-v9-js-vitest.mdx)                             |
| `@ladamczyk/qoq-eslint-v9-js-vitest-rtl` | [JavaScript + Vitest + React Testing Library](./presets/eslint-v9-js-vitest-rtl.mdx) |
| `@ladamczyk/qoq-eslint-v9-ts`            | [TypeScript](./presets/eslint-v9-ts.mdx)                                             |
| `@ladamczyk/qoq-eslint-v9-ts-react`      | [TypeScript + React](./presets/eslint-v9-ts-react.mdx)                               |
| `@ladamczyk/qoq-eslint-v9-ts-jest`       | [TypeScript + Jest](./presets/eslint-v9-ts-jest.mdx)                                 |
| `@ladamczyk/qoq-eslint-v9-ts-jest-rtl`   | [TypeScript + Jest + React Testing Library](./presets/eslint-v9-ts-jest-rtl.mdx)     |
| `@ladamczyk/qoq-eslint-v9-ts-vitest`     | [TypeScript + Vitest](./presets/eslint-v9-ts-vitest.mdx)                             |
| `@ladamczyk/qoq-eslint-v9-ts-vitest-rtl` | [TypeScript + Vitest + React Testing Library](./presets/eslint-v9-ts-vitest-rtl.mdx) |

Usage — extend the preset's array with `defineConfig` and scope it with your own `files`:

```js
// ESM
import { configs } from '@ladamczyk/qoq-eslint-v9-ts-react';
import { defineConfig } from 'eslint/config';

export default defineConfig({
  files: ['src/**/*.{ts,tsx}'],
  extends: [configs.base],
});
```

`extends` keeps the preset's entries as separate config objects, so ESLint's own cascade merges them per file and your block always wins last — the pre-merged `baseConfig` spread of earlier versions silently dropped rule options along the way. Upgrading from v5: replace `...baseConfig` with `extends: [configs.base]`.

## `qoq-prettier`

Base Prettier preset. Reference it directly in `.prettierrc` (`"@ladamczyk/qoq-prettier"`) or import `@ladamczyk/qoq-prettier/config` and spread it into your own config.

## `qoq-prettier-with-json-sort`

The same base preset plus automatic JSON key sorting. Used the same way — drop `"@ladamczyk/qoq-prettier-with-json-sort"` into `.prettierrc` or extend `@ladamczyk/qoq-prettier-with-json-sort/config`.

## `qoq-knip`

Opinionated Knip configuration for detecting unused files, exports, and dependencies. Exports `jsConfig`, `jsReactConfig`, `tsConfig`, and `tsReactConfig` in both CommonJS and ESM for use in your Knip config file.

## `qoq-jscpd`

A ready-made copy-paste detection config. Point JSCPD at the shipped config file:

```bash
jscpd -c ./node_modules/@ladamczyk/qoq-jscpd/index.json
```

## `qoq-stylelint-css`

Stylelint config template for CSS.

## `qoq-stylelint-scss`

Stylelint config template for SCSS.

## `structurelint`

A standalone [file/folder structure linter](https://adamczyk.ovh/docs/structurelint), published as `@ladamczyk/structurelint` in its own repository with its own release cadence — it isn't versioned lockstep with the `qoq-*` packages above. The CLI's optional Structurelint check installs and drives it — enable it via a `structurelint` block in `qoq.config.js` (see [Configuration](./configuration.md#structurelint)).

## `skillslint`

A standalone [agent-skill linter](https://adamczyk.ovh/docs/skillslint), published as `@ladamczyk/skillslint` in its own repository with its own release cadence — like Structurelint, it isn't versioned lockstep with the `qoq-*` packages. The CLI's optional Skillslint check installs and drives it — enable it via a `skillslint` block in `qoq.config.js` (see [Configuration](./configuration.md#skillslint)).

## `justify-disable`

A standalone [lint-disable justification checker](https://adamczyk.ovh/docs/justify-disable), published as `@ladamczyk/justify-disable` in its own repository with its own release cadence — like Structurelint and Skillslint, it isn't versioned lockstep with the `qoq-*` packages. The CLI's optional Justify-disable check drives it as an optional peer, installed only when you set a `justifyDisable` block to `warn` or `error` in `qoq.config.js` (see [Configuration](./configuration.md#justify-disable)).

## `qoq-utils`

Shared internal helpers used across the QoQ packages.

## `check-engine`

A standalone CLI that validates your project's own `engines.node` against the `engines.node` ranges declared by its dependencies, in every workspace of a monorepo (discovered from `workspaces`), and reports each workspace before exiting once. It also prints an advisory with the current and maintained Node LTS versions. Run `check-engine -h` for options:

- `--include <list>` — also check `dev`, `peer` and `optional` dependency groups (comma-separated)
- `--no-lts` — skip the Node LTS lookup and its advisory
- `--json` — write the report as JSON to stdout
- `--quiet` — print nothing to stderr when every workspace passes

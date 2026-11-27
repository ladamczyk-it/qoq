---
sidebar_position: 4
title: Packages | v6.x
sidebar_label: Packages | v6.x
description: 'The @ladamczyk/qoq-* packages in 6.x: the CLI, ESLint v9 flat-config presets with configs.base and delta layers, Prettier, Knip, JSCPD, Stylelint and check-engine. | v6.x'
---

All packages live under `@ladamczyk/*` and are versioned together.

## `qoq-cli`

The command-line entry point: Config Wizard, config handlers, and the executors that run each tool through its JavaScript API. Adds `qoq scan` in 6.3 and the Justify-disable executor in 6.8.

## `qoq-eslint-v9-*`

Twelve [Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files) presets, JavaScript or TypeScript crossed with plain, React, Jest, Jest + React Testing Library, Vitest and Vitest + React Testing Library:

`qoq-eslint-v9-js`, `-js-react`, `-js-jest`, `-js-jest-rtl`, `-js-vitest`, `-js-vitest-rtl`, `qoq-eslint-v9-ts`, `-ts-react`, `-ts-jest`, `-ts-jest-rtl`, `-ts-vitest`, `-ts-vitest-rtl`.

### What changed in 6.0

Each preset exports a `configs` object of flat-config **arrays** instead of a pre-merged default export, and its own delta layer (`jsLayer`, `tsLayer`, `reactLayer`, `jestLayer`, `rtlLayer`, …). ESLint's own cascade does the merging:

```js
import { configs } from '@ladamczyk/qoq-eslint-v9-ts';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  { files: ['**/*.ts'], extends: [configs.base] },
  { files: ['**/*.spec.ts'], extends: [configs.test] }
);
```

`qoq-eslint-v9-ts` also exports `configs.test`, which relaxes the strictest type-aware rules for tests, and `configs.strict`, which opts into extra `typescript-eslint` strict-family rules.

Migrating from 5.x: replace `...baseConfig` with `extends: [configs.base]`. `extends` keeps the preset's entries as separate config objects, so ESLint merges them per file and your block wins last. Also note:

- `baseConfig` is gone from every preset; use `configs.base`. `qoq-eslint-v9-ts` drops `testConfig` and `strictConfig` too.
- `baseConfig` in `qoq-eslint-v9-js` is renamed `jsLayer`, and `disabledRules` is no longer exported from the js test and React presets.
- The RTL presets now enable 21 `testing-library/*` rules that were registered but never on, such as `await-async-queries`, `no-node-access` and `prefer-find-by`.
- The React presets keep two options the old merge dropped: React imports sort first under `import-x/order`, and `lodash/debounce` is restricted.

The CLI fails on warnings as well as errors, so each of these can break a build on upgrade.

Preview any preset's rules with `npx -y @ladamczyk/qoq-eslint-v9-ts` (ESLint Config Inspector).

## `qoq-prettier` and `qoq-prettier-with-json-sort`

Prettier presets; the second also sorts JSON keys. Reference one in `.prettierrc` (`"@ladamczyk/qoq-prettier"`) or import `@ladamczyk/qoq-prettier/config` and spread it into your own config.

## `qoq-knip`

Knip configuration for unused files, exports and dependencies. Exports `jsConfig`, `jsReactConfig`, `tsConfig` and `tsReactConfig` (CommonJS and ESM), plus `getKnipConfig` to build your own.

## `qoq-jscpd`

A ready-made copy-paste detection config:

```bash
jscpd -c ./node_modules/@ladamczyk/qoq-jscpd/index.json
```

## `qoq-stylelint-css` and `qoq-stylelint-scss`

Stylelint templates for CSS and SCSS.

## `qoq-utils`

Shared internal helpers used across the QoQ packages.

## `check-engine`

Checks that a package's `engines.node` is compatible with what its dependencies declare, across every workspace. Each workspace is reported before one exit. 6.2 added:

- `--include <list>` — also check `dev`, `peer` and `optional` dependency groups
- `--no-lts` — skip the Node LTS lookup and its advisory
- `--json` — the report as JSON on stdout
- `--quiet` — print nothing when every workspace passes

## Separate packages

`@ladamczyk/structurelint`, `@ladamczyk/skillslint`, `@ladamczyk/justify-disable` and `@ladamczyk/outdated` live in their own repositories; the wizard installs them when you opt in.

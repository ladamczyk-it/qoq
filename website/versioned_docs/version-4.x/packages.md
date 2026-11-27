---
sidebar_position: 4
title: Packages | v4.x
sidebar_label: Packages | v4.x
description: 'The @ladamczyk/qoq-* packages in 4.x: the CLI, ESLint v9 flat-config presets including qoq-eslint-v9-ts-react-structure, Prettier, Knip, JSCPD, Stylelint and check-engine. | v4.x'
---

All packages live under `@ladamczyk/*` from 4.0 (previously `@saashub/*`) and are versioned together.

## `qoq-cli`

The command-line entry point: Config Wizard, config handlers and executors.

## `qoq-eslint-v9-*`

Twelve [Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files) presets: `qoq-eslint-v9-js` and `qoq-eslint-v9-ts`, each with `-react`, `-jest`, `-jest-rtl`, `-vitest` and `-vitest-rtl` variants. Each exports a pre-merged `baseConfig` object to spread; `qoq-eslint-v9-ts` also exports `testConfig`.

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-ts';

export default [
  {
    ...baseConfig,
    files: ['**/*.ts'],
  },
];
```

Preview any preset's rules with `npx -y @ladamczyk/qoq-eslint-v9-ts`.

## `qoq-eslint-v9-ts-react-structure`

Added in **4.3**, removed in 5.0. A standalone folder/file structure preset for TypeScript + React built on [`eslint-plugin-project-structure`](https://github.com/Igorkowalski94/eslint-plugin-project-structure). It encodes a feature-sliced layout (`components`, `features`, `helpers`, `config`, `store`, `services`) with casing conventions, rooted at `src/` by default. Apply it as its own config block, since it uses the project-structure parser.

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

Checks a package's `engines.node` against its dependencies' requirements.

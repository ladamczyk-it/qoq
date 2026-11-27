---
sidebar_position: 4
title: Packages | v5.x
sidebar_label: Packages | v5.x
description: 'The @ladamczyk/qoq-* packages in 5.x: the CLI, twelve ESLint v9 flat-config presets exporting baseConfig, Prettier, Knip, JSCPD, Stylelint and check-engine. | v5.x'
---

All packages live under `@ladamczyk/*` and are versioned together.

## `qoq-cli`

The command-line entry point: Config Wizard, config handlers, and executors that run each tool through its JavaScript API from 5.0.

## `qoq-eslint-v9-*`

Twelve [Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files) presets: `qoq-eslint-v9-js` and `qoq-eslint-v9-ts`, each with `-react`, `-jest`, `-jest-rtl`, `-vitest` and `-vitest-rtl` variants.

In 5.x each preset exports a pre-merged `baseConfig` object to spread:

```js
import { baseConfig } from '@ladamczyk/qoq-eslint-v9-ts';

export default [
  {
    ...baseConfig,
    files: ['**/*.ts'],
  },
];
```

`qoq-eslint-v9-ts` also exports `testConfig`, and `strictConfig` from **5.1**. 6.0 replaced these objects with `configs.*` arrays.

Preview any preset's rules with `npx -y @ladamczyk/qoq-eslint-v9-ts`.

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

## Removed in 5.0

`qoq-eslint-v9-ts-react-structure`, the `eslint-plugin-project-structure` preset added in 4.3.

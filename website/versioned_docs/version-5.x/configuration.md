---
sidebar_position: 3
title: Configuration | v5.x
sidebar_label: Configuration | v5.x
description: 'Every qoq.config.js section in QoQ 5.x: srcPath, configPaths, configType, npm, Prettier, JSCPD, Knip, ESLint templates, Stylelint, Structurelint and Skillslint. | v5.x'
---

`qoq.config.js` exports one CommonJS or ESM object. Every section is optional.

## General

- `srcPath` (default `./src`) — fallback path for every tool.
- `configPaths` — `{ eslint: '/eslint.config.js', prettier: '/.prettierrc', stylelint: '/stylelint.config.js' }`. A leading `/` means the current working directory.
- `configType` — `'CJS'` or `'ESM'`, from **5.0.1**. Overrides the format detected from `package.json` `type`.

## npm

Default check through `npm outdated`; skip with `--skip-npm`.

```js
{
  npm: {
    checkOutdatedEvery: 1, // days; 0 checks on every run
  },
}
```

## Prettier

`sources` (default `[srcPath]`); respects `.prettierignore`. Skip with `--skip-prettier`.

## JSCPD

`format`, `ignore` and `threshold` (default `2`), as in the [JSCPD options](https://github.com/kucherenko/jscpd/tree/master/apps/jscpd). Skip with `--skip-jscpd`.

## Knip

`entry`, `project`, `ignore`, `ignoreDependencies` (default `['@ladamczyk/qoq-*']`) and `ignoreBinaries`, plus `ignoreFiles`, `ignoreMembers` and `ignoreUnresolved` from **5.2**. See the [Knip configuration](https://knip.dev/reference/configuration). Skip with `--skip-knip`.

## ESLint

An array of configuration objects, each optionally naming a `template`:

```js
{
  eslint: [
    { template: 'qoq-eslint-v9-ts', files: ['src/**/*.ts'], ignores: ['**/*.spec.ts'] },
    { template: 'qoq-eslint-v9-ts-vitest', files: ['src/**/*.spec.ts'] },
  ],
}
```

In 5.x the template's pre-merged `baseConfig` is merged with your entry. Skip with `--skip-eslint`.

## Stylelint

Optional: `template` (`qoq-stylelint-css` or `qoq-stylelint-scss`) and `strict` (default `false`; `true` fails on warnings). Skip with `--skip-stylelint`.

## Structurelint

Optional, backed by [`@ladamczyk/structurelint`](https://adamczyk.ovh/docs/structurelint). The block mirrors structurelint's config directly, so no separate `structure.config.*` file is read:

```js
{
  structurelint: {
    structureRoot: '.',
    structure: [{ name: 'src', children: [] }],
  },
}
```

`rules` and `ignorePatterns` are supported too. Skip with `--skip-structurelint`.

## Skillslint

Optional, backed by [`@ladamczyk/skillslint`](https://adamczyk.ovh/docs/skillslint). `path` defaults to `./skills`. Skip with `--skip-skillslint`.

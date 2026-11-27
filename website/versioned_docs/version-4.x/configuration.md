---
sidebar_position: 3
title: Configuration | v4.x
sidebar_label: Configuration | v4.x
description: 'Every qoq.config.js section in QoQ 4.x: srcPath, configPaths, npm, Prettier, JSCPD, Knip, ESLint templates, Stylelint, Structurelint and Skillslint. | v4.x'
---

`qoq.config.js` exports one CommonJS or ESM object. Every section is optional. From **4.4** the CLI warns about entries that repeat a default, or ESLint rules the chosen template already declares.

## General

- `srcPath` (default `./src`) — fallback path for every tool.
- `configPaths` — `{ eslint: '/eslint.config.js', prettier: '/.prettierrc', stylelint: '/stylelint.config.js' }`. A leading `/` means the current working directory.

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

`entry`, `project`, `ignore`, `ignoreDependencies` (default `['@ladamczyk/qoq-*']`) and `ignoreBinaries`, as in the [Knip configuration](https://knip.dev/reference/configuration). Skip with `--skip-knip`.

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

Skip with `--skip-eslint`.

## Stylelint

Optional: `template` (`qoq-stylelint-css` or `qoq-stylelint-scss`) and `strict` (default `false`; `true` fails on warnings). Skip with `--skip-stylelint`.

## Skillslint

Optional, added in **4.3**, backed by [`@ladamczyk/skillslint`](https://adamczyk.ovh/docs/skillslint): lints Claude Code skill docs with textlint. `path` defaults to `./skills`. Skip with `--skip-skillslint`.

## Structurelint

Optional, added in **4.5**, backed by [`@ladamczyk/structurelint`](https://adamczyk.ovh/docs/structurelint). Runs before Skillslint.

- **4.5.0–4.5.1** read rules from `structure.config.{ts,js,mjs}`; the block takes only `path` (default `.`).
- **4.5.2** reads them from the block itself, mirroring structurelint's own config:

```js
{
  structurelint: {
    structureRoot: '.',
    structure: [{ name: 'src', children: [] }],
  },
}
```

Skip with `--skip-structurelint`.

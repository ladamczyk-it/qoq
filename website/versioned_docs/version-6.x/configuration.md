---
sidebar_position: 3
title: Configuration | v6.x
sidebar_label: Configuration | v6.x
description: 'Every qoq.config.js section in QoQ 6.x: general settings, npm, Prettier, JSCPD, Knip, ESLint, Stylelint, Structurelint, Skillslint, Justify-disable and qoq scan. | v6.x'
---

`qoq.config.js` exports one object. Every section is optional and falls back to opinionated defaults. From **6.1.6** the config can also be `qoq.config.ts` (or `.mjs`/`.cjs`), typed with `satisfies QoqConfig` imported from `@ladamczyk/qoq-cli`.

## General

- `srcPath` (default `./src`) — fallback path for every tool.
- `configPaths` — `{ eslint: '/eslint.config.js', prettier: '/.prettierrc', stylelint: '/stylelint.config.js' }`. A leading `/` means the current working directory.
- `configType` — `'CJS'` or `'ESM'`, overriding the format detected from `package.json` `type`.
- `stats` — usage-statistics consent. Unset means "not asked yet"; the first interactive run asks and writes the answer back. Added in 6.0.
- `hints` (default `true`, from 6.4.1) — `false` hides the `/qoq` skill hint printed after interactive runs, `qoq scan` and `--init`.
- `future` — experimental opt-ins the skill reads and the CLI ignores: `unstable_skill_docs`, `unstable_skill_bump_with_scan`, `unstable_skill_diagrams`, `unstable_skill_sheriff`, `unstable_skill_review`, and `unstable_skill_plan_jira` / `_linear` / `_trello`.

## npm

Default check: flags outdated, deprecated and stale dependencies through `@ladamczyk/outdated` (from 6.2; plain `npm outdated` before). Skip one run with `--skip-npm`.

```js
{
  npm: {
    checkOutdatedEvery: 1, // days; 0 checks on every run
  },
}
```

## Prettier

```js
{
  prettier: {
    sources: ['./src'], // defaults to [srcPath]
  },
}
```

Respects `.prettierignore`. Skip with `--skip-prettier`.

## JSCPD

`format`, `ignore` and `threshold` (default `2`) follow the [JSCPD options](https://github.com/kucherenko/jscpd/tree/master/apps/jscpd). Skip with `--skip-jscpd`.

## Knip

`entry`, `project`, `ignore`, `ignoreDependencies` (default `['@ladamczyk/qoq-*']`), `ignoreBinaries`, `ignoreFiles`, `ignoreMembers` and `ignoreUnresolved` follow the [Knip configuration](https://knip.dev/reference/configuration). `entry` defaults to `${srcPath}/{index,cli,main,root}.*` and `project` to `${srcPath}/**/*.*`, with extensions taken from the installed presets. Skip with `--skip-knip`.

## ESLint

An array of [configuration objects](https://eslint.org/docs/latest/use/configure/configuration-files#configuration-objects). Each may name a `template` — any `@ladamczyk/qoq-eslint-v9-*` package — to extend:

```js
{
  eslint: [
    { template: 'qoq-eslint-v9-ts', files: ['src/**/*.ts'], ignores: ['**/*.spec.ts'] },
    { template: 'qoq-eslint-v9-ts-vitest', files: ['src/**/*.spec.ts'] },
  ],
}
```

From 6.0 each entry is composed with `defineConfig({ files, extends: [configs.base] })`. Skip with `--skip-eslint`.

## Stylelint

Optional: runs only when the block is present.

```js
{
  stylelint: {
    template: 'qoq-stylelint-css', // or 'qoq-stylelint-scss'
    strict: false, // true fails on warnings too
  },
}
```

Skip with `--skip-stylelint`.

## Structurelint

Optional, backed by [`@ladamczyk/structurelint`](https://adamczyk.ovh/docs/structurelint). The block mirrors structurelint's own config: `structure` (required for any validation), `structureRoot` (default `.`), `rules` and `ignorePatterns`. Runs before Skillslint. Skip with `--skip-structurelint`.

## Skillslint

Optional, backed by [`@ladamczyk/skillslint`](https://adamczyk.ovh/docs/skillslint): lints Claude Code skill docs. `path` defaults to `./skills`. Skip with `--skip-skillslint`.

## Justify-disable

Optional, added in **6.8**, backed by [`@ladamczyk/justify-disable`](https://adamczyk.ovh/docs/justify-disable): checks that lint-disable comments carry a justification.

```js
{
  justifyDisable: {
    severity: 'warn', // 'warn' | 'error' | 'off' (default)
  },
}
```

It scans the files matched by your `eslint` entries and the Stylelint glob. Outside a git repository it warns and passes. Skip with `--skip-justify-disable`; `--json` writes `justify-disable-report.json`.

## Scan

Added in **6.3**. `qoq scan` checks `package-lock.json` for known vulnerabilities. It never runs as part of `--check`, `--fix` or `staged`.

```bash
qoq scan [--json] [--output <path>] [--timeout <ms>] [--production] [--graph] [--silent]
```

- `--json` writes `scan-report.json` to `--output` (default `bin/report`). From 6.5 each finding carries `dev` and `via`, the dependency chains that pull it in.
- `--graph` prints each vulnerable `name@version` as an inverted tree up to the `package.json` that declares it, from the lockfile alone.
- Exit `1` only for a complete scan with a finding at or above `failOn`; `skipped` and `inconclusive` exit `0`.

```js
{
  scan: {
    adapter, // { name, scan(deps, { signal }) }; defaults to OSV.dev
    timeout: 10000,
    failOn: 'high', // low | moderate | high | critical | none
  },
}
```

A custom adapter receives deduplicated `{ name, version, dev }` dependencies from `registry.npmjs.org` and resolves `{ findings, complete, reason? }`. `IScanAdapter` and `IScanFinding` are exported from `@ladamczyk/qoq-cli`.

---
sidebar_position: 3
title: Configuration
description: Every qoq.config.js section and its defaults, from Prettier and Knip to ESLint, Stylelint, and Skillslint.
---

# Configuration

`qoq.config.js` exports a single configuration object. Every section is optional and falls back to opinionated defaults.

## TypeScript config

The config can be authored as `qoq.config.{js,ts,mjs,cjs}`. For a TypeScript config, import the exported `QoqConfig` type and annotate the object with `satisfies` — this gives you autocomplete and type-checking while keeping the literal's own inferred type intact:

```ts
import type { QoqConfig } from '@ladamczyk/qoq-cli';

export default {
  srcPath: './src',
} satisfies QoqConfig;
```

Prefer `satisfies QoqConfig` over a `: QoqConfig` annotation: it still validates every field against the schema, but it doesn't widen the literal to the type, so the precise types of what you wrote stay visible to the rest of your tooling.

A `qoq.config.ts` is type-stripped in memory (Node's `stripTypeScriptTypes`, hence the `>=22.15` engine) and imported as a data URL — no temporary `qoq.config.ts.<uuid>.mjs` is written next to it, so nothing can leak into the project root if a run is killed. Bare and relative `import`s in the config still resolve from its real location, exactly as they would from a file on disk.

## General

- **`srcPath`** (default `./src`) — fallback path used when a tool isn't given explicit sources.
- **`configType`** (`'CJS' | 'ESM'`) — overrides the module format auto-detected from your own `package.json`'s `type` field, for the config files QoQ generates for the underlying tools (ESLint, Stylelint, …). Explicit config authoring only — the Config Wizard doesn't offer it.
- **`configPaths`** — override where the CLI looks for each tool's config. Each override must begin with a leading `/`, which resolves relative to `process.cwd()`.
- **`hints`** (default `true`) — set to `false` to hide the [qoq skill hint](./index.mdx#the-qoq-skill) that interactive runs, `qoq scan` and `--init` print at the end. It is never printed in CI, under `staged`, `--silent` or `--warmup`, when output is piped, inside Claude Code, or once the skill is installed.
- **`future`** — opt-ins for experimental features, all off by default. The CLI reads none of them; the [qoq skill](./skills/qoq/index.md#experimental-switches) does:
  - `unstable_skill_docs` — `/qoq execute` documents every delivered milestone, as if run with `--docs`.
  - `unstable_skill_bump_with_scan` — `/qoq bump` also plans fixes for known vulnerabilities from `qoq scan`, as if run with `--scan`.
  - `unstable_skill_diagrams` — `qoq-artist` draws validated Mermaid charts into the plan before approval in `/qoq plan` and `/qoq replan`, and into each milestone's docs in `/qoq execute` when docs are on too, as if run with `--diagrams`. Standalone `/qoq mermaid` needs no switch.
  - `unstable_skill_plan_jira`, `unstable_skill_plan_linear`, `unstable_skill_plan_trello` — allow `/qoq plan --tool <tracker>` and `/qoq execute --source <tracker>`. Unlike the others, the flag alone is not enough: without the matching switch the run stops before it starts, because only `local` is tested.
- **`stats`** (`true | false`) — consent for [anonymous usage statistics](./index.mdx#usage-statistics). Left out of the config it means "not asked yet", and the CLI asks once — on the first interactive run that has a config file to record the answer in — then writes the key back here. Set it by hand to answer without being asked.
- **`learning`** (`true | false`) — consent for the [qoq skill](./skills/qoq/index.md) to send its retro's planning and skill lessons (never code) to the learning sink. Separate from `stats`, which promises a count and nothing more. The CLI itself never reads it.

```js
{
  srcPath: './src',
  configPaths: {
    eslint: '/eslint.config.js',
    prettier: '/.prettierrc',
    stylelint: '/stylelint.config.js',
  },
}
```

For example, an ESLint config stored at `configs/eslint.config.local.js` is referenced as `/configs/eslint.config.local.js`.

## NPM

```js
{
  npm: {
    checkOutdatedEvery: 1, // days between outdated-dependency checks (default 1)
  },
}
```

## Prettier

```js
{
  prettier: {
    sources: ['.'], // paths to format; defaults to [srcPath]
  },
}
```

Execution respects your `.prettierignore`.

## JSCPD

```js
{
  jscpd: {
    format: [...], // see jscpd docs
    ignore: [...], // see jscpd docs
    threshold: 2,  // max allowed duplication %, default 2
  },
}
```

## Knip

```js
{
  knip: {
    entry: [...],              // default: [${srcPath}/{index,cli,main,root}.{ts,tsx,js,jsx}]
    project: [...],            // default: [${srcPath}/**/*.{ts,tsx,js,jsx}]
    ignore: [...],
    ignoreDependencies: [...], // default: ['@ladamczyk/qoq-*']
    ignoreBinaries: [...],
    ignoreFiles: [...],
    ignoreMembers: [...],
    ignoreUnresolved: [...],
    workspaces: { website: {} }, // extra Knip workspaces, passed to Knip verbatim
  },
}
```

File extensions in the `entry`/`project` defaults are derived from the QoQ modules you have installed.

`workspaces` adds extra Knip [workspaces](https://knip.dev/features/monorepos-and-workspaces), passed to Knip's config verbatim. Use it for a nested package with its own `package.json` that isn't an npm workspace, such as a docs site in `website/`: Knip then checks that directory's dependencies against its own `package.json`, and stops counting its files as the root's. Each value is a Knip workspace config (`entry`, `project`, `ignoreDependencies`, …); `{}` leaves it to Knip's plugins. When it's set and the repo has no npm `workspaces`, `entry` and `project` move under the root workspace `"."`; with npm `workspaces`, these entries are merged over them.

## ESLint

Use standard ESLint [flat config objects](https://eslint.org/docs/latest/use/configure/configuration-files#configuration-objects), and extend a QoQ preset through the `template` property. The value is the **unscoped** package name (the CLI prepends `@ladamczyk/` for you), so write `qoq-eslint-v9-ts`, not `@ladamczyk/qoq-eslint-v9-ts`. Each entry may also carry its own `files`, `ignores`, and `rules`:

```js
{
  eslint: [
    {
      template: 'qoq-eslint-v9-ts', // extends configs.base from this template
      files: ['packages/**/src/**/*.ts'],
      ignores: ['**/*.spec.ts'],
      rules: {}, // additional ESLint rules
    },
    {
      template: 'qoq-eslint-v9-ts-vitest',
      files: ['packages/**/src/**/*.spec.ts'],
    },
  ],
}
```

Available `template` values (any [`@ladamczyk/qoq-eslint-v9-*`](https://www.npmjs.com/search?q=%40ladamczyk%2Fqoq-eslint-v9-) package, minus the scope): `qoq-eslint-v9-{js,ts,js-react,ts-react,js-jest,ts-jest,js-jest-rtl,ts-jest-rtl,js-vitest,ts-vitest,js-vitest-rtl,ts-vitest-rtl}`.

The generated ESLint config composes each entry with `defineConfig({ extends: [configs.base], ...yourBlock })` (v6.0.0 and later), so precedence runs template → monorepo overrides → your own `rules`/`ignores`, resolved by ESLint's cascade rather than by a pre-merge. A hand-written template of your own therefore has to export `configs.base`; one that only exports the old `baseConfig` no longer works with the CLI.

## Stylelint

Use a standard Stylelint [config object](https://stylelint.io/user-guide/configure) and extend a QoQ preset via `template`. As with ESLint, the value is the **unscoped** package name — `qoq-stylelint-css` or `qoq-stylelint-scss` (the SCSS preset extends the CSS one). Omit the whole `stylelint` section to disable it:

```js
{
  stylelint: {
    template: 'qoq-stylelint-css', // or 'qoq-stylelint-scss'
    strict: false, // true = fail on warnings
  },
}
```

## Structurelint

Validates your project's file/folder structure via [Structurelint](https://adamczyk.ovh/docs/structurelint). It runs only when a `structurelint` section is present; omit the section to disable it. Unlike the other sections, this one isn't a separate config-file pointer — the block mirrors Structurelint's own config shape (`IStructureConfig`) directly, so you author the rules inline in `qoq.config.*` instead of a standalone `structure.config.{ts,js,mjs}`:

```js
{
  structurelint: {
    structureRoot: '.', // root folder to validate, default '.'
    ignorePatterns: ['*.d.ts'], // optional glob-ish names/paths to ignore
    rules: {}, // optional reusable named rules, referenced from `structure` via `{ ruleId }`
    structure: [
      // required — allowed children of the root folder
    ],
  },
}
```

`structure` is required — the CLI errors out if the `structurelint` section is present without it. See the [Structurelint](https://adamczyk.ovh/docs/structurelint) page for the full `structure`/`rules` syntax and worked examples.

## Skillslint

Lints your [agent skills](https://adamczyk.ovh/docs/skillslint) (`SKILL.md` files) as part of the pipeline — markdown prose quality plus structured quality scoring. It runs only when a `skillslint` section is present **and** `@ladamczyk/skillslint` is installed; omit the section to disable it. The [Config Wizard](./installation.md) adds the section and installs the package when you opt into agent-skills linting.

```js
{
  skillslint: {
    path: './skills', // directory of skill subdirectories (default ./skills)
    threshold: 70,    // overall quality floor 0–100, used when no per-category floors are set
    ignored: [],      // skill directory names to skip
    overall: 80,      // optional per-category score floors (0–100)
    structure: 80,
    clarity: 80,
    specificity: 80,
    advanced: 80,
  },
}
```

Only `path` is required; everything else falls back to Skillslint's own defaults. `qoq --fix` forwards `--fix` so Skillslint auto-corrects what textlint can resolve. See the [Skillslint](https://adamczyk.ovh/docs/skillslint) page for the scoring categories and bundled rules.

## Justify-disable

Checks that lint-disable comments carry a justification, via [Justify-disable](https://adamczyk.ovh/docs/justify-disable). It runs only when a `justifyDisable` section is present with `severity` set to `warn` or `error`; omit the section, or leave `severity` at `'off'`, to disable it. It is backed by the optional peer `@ladamczyk/justify-disable`, which the [Config Wizard](./installation.md) installs, and writes the section for, only when you choose `warn` or `error`.

```js
{
  justifyDisable: {
    severity: 'warn', // 'warn' | 'error' | 'off' (default)
  },
}
```

- `severity` applies to the package's `missingReason`, `expired` and `invalidCondition` rules; `missingDate` stays off.
- The scan covers files matched by an `eslint` entry's `files`/`ignores` (ESLint's default `**/*.{js,mjs,cjs}` when an entry has none), or by the stylelint glob, limited to the extensions the package assigns to each tool. `staged` filters the staged paths the same way.
- Outside a git repository it prints a warning and passes.
- `--skip-justify-disable` skips it for one run. `--json` writes `justify-disable-report.json`. A failed run suggests `/qoq fix`.

## Scan

`qoq scan` checks the dependencies in `package-lock.json` for known vulnerabilities, using OSV.dev (`api.osv.dev`, no key) by default. It is on-demand only: it never runs as part of `--check`, `--fix` or `staged`, and has no `--skip-*` flag.

```bash
qoq scan [--json] [--output <path>] [--timeout <ms>] [--production] [--graph] [--silent]
```

- `--json` writes `scan-report.json` (`{ status, reason?, adapter, findings[] }`) to `--output`, default `bin/report`. qoq adds two fields from `package-lock.json` to each finding, overwriting anything the adapter set:
  - `dev` — `true` when every installed copy is dev-only.
  - `via` — one `{ manifest, direct, parent? }` per distinct way the package is installed. `manifest` is the `package.json` (root or workspace) that declares `direct`, and `parent` is the package that requires the vulnerable one, omitted when the vulnerable package is itself `direct`. These are the same chains `--graph` draws, as data.
- `--timeout` overrides `scan.timeout`.
- `--production` scans production dependencies only.
- `--graph` prints each vulnerable `name@version` as an inverted tree of the packages that pull it in, up to the `package.json` that declares each chain. Built from `package-lock.json` alone — no network, no `npm ls`.
- `--silent` suppresses the status line on the console.

```js
{
  scan: {
    adapter, // { name, scan(deps, { signal }) } — defaults to OSV.dev
    timeout: 10000, // milliseconds (default 10000)
    failOn: 'high', // 'low' | 'moderate' | 'high' | 'critical' | 'none' (default 'high')
  },
}
```

Limits:

- **Lockfile only.** Reads `package-lock.json` (`lockfileVersion` ≥ 2) from the current directory — no pnpm, yarn or shrinkwrap. Inside a workspace member there is no lockfile, so the scan reports `skipped (no package-lock.json)`.
- **Registry only.** Only packages resolved from `https://registry.npmjs.org/` are sent to the scanner; private registry names never leave the machine.
- **Proxy.** Node's `fetch` ignores `HTTPS_PROXY`, so behind a proxy the default OSV scan reports `inconclusive` and exits `0`.
- **Exit codes.** Exit `1` only for a complete scan with a finding at or above `failOn` (unrated advisories count as `critical`). `skipped` and `inconclusive` always exit `0`.

The `IScanAdapter` and `IScanFinding` types are exported from `@ladamczyk/qoq-cli`, so you can swap OSV.dev for your own source. The adapter only returns `{ findings, complete, reason? }`; reading the lockfile, the timeout, sorting, the table, `--graph`, the JSON report and the exit code stay with qoq.

## Config health check

Every run (`qoq --check`, `qoq staged`, `qoq --fix`) also performs an in-process self-check of your `qoq.config.js`: it warns about entries that are redundant because they merely restate a tool default (e.g. `jscpd.threshold: 2`) or a rule already declared in the `qoq-eslint-v9-*` template an `eslint` entry extends. It never fails the run — it only prints warnings — and there is no config section to enable or disable it.

```
Config health check found 2 redundant entries:
  • jscpd.threshold = 2 — matches the tool default
  • eslint[0].rules.no-console = "warn" — already set in qoq-eslint-v9-ts base config
```

Use `--silent` to suppress it along with the rest of QoQ's console output.

# General settings

There are two general settings:

- `srcPath` (default to `./src`) that is used as a fallback to tools execution.
- `configPaths` via:

```js
{
    configPaths: {
        eslint: '/eslint.config.js',
        prettier: '/.prettierrc',
        stylelint: '/stylelint.config.js',
    }
}
```

where every entry has defaults as above, any override needs to start with leading slash `/` that is translated to `${process.cwd()}/`.

Let's say You execute `qoq --check` in project root path and `Eslint` config is in `configs` dir with name `eslint.config.local.js` oveeride should be then `/configs/eslint.config.local.js`.

# NPM

The **NPM packages check** is a default check — it runs on every `qoq --check`, `qoq staged`, and `qoq --fix` without any configuration, surfacing outdated, deprecated and stale dependencies via `@ladamczyk/outdated`. Skip it for a single run with `--skip-npm`.

Its execution can be configured via:

```js
{
  npm: {
    checkOutdatedEvery: 1;
  }
}
```

where:

- `checkOutdatedEvery` is `number` that tells how often should we check dependencies. Defaults to `1` day. Set `0` to check on every run.

# Prettier

Prettier execution can be configured via:

```js
{
    prettier: {
        sources: [...]
    }
}
```

where:

- `sources` is `string[]` that holds paths to format. Defaults to `[${srcPath}]`.

Execution will respect `.prettierignore` config.

# JSCPD

JSCPD execution can be configured via:

```js
{
    jscpd: {
        format: [...],
        ignore: [...],
        threshold: 2
    }
}
```

where:

- `format` described in [source docs](https://github.com/kucherenko/jscpd/tree/master/apps/jscpd#format)
- `ignore` described in [source docs](https://github.com/kucherenko/jscpd/tree/master/apps/jscpd#ignore)
- `threshold` described in [source docs](https://github.com/kucherenko/jscpd/tree/master/apps/jscpd#threshold), default to `2`

# Knip

Knip execution can be configured via:

```js
{
    knip: {
        entry: [...],
        project: [...],
        ignore: [...],
        ignoreDependencies: [...],
        ignoreBinaries: [...]
    }
}
```

where:

- `entry` described in [source docs](https://knip.dev/reference/configuration#entry), defaults to `[${srcPath}/{index,cli,main,root}.{ts,tsx,js,jsx}]` (file extensions are retreived from installed qoq modules)
- `project` described in [source docs](https://knip.dev/reference/configuration#project-1), defaults to `[${srcPath}/**/*.{ts,tsx,js,jsx}]` (file extensions are retreived from installed qoq modules)
- `ignore` described in [source docs](https://knip.dev/reference/configuration#ignore)
- `ignoreDependencies` described in [source docs](https://knip.dev/reference/configuration#ignoredependencies), defaults to `['@ladamczyk/qoq-*']`
- `ignoreBinaries` described in [source docs](https://knip.dev/reference/configuration#ignorebinaries)

# Eslint

Requires standard [configuration objects](https://eslint.org/docs/latest/use/configure/configuration-files#configuration-objects) but You can extend QoQ templates via `template` prop in each config where value is valid [@ladamczyk/qoq-eslint-v9-\*](https://www.npmjs.com/search?q=%40ladamczyk%2Fqoq-eslint-v9-) package eg:

```js
{
    eslint: [
        {
            template: 'qoq-eslint-v9-ts',
            files: ['packages/**/src/**/*.ts'],
            ignores: ['**/*.spec.ts'],
            ...
        },
        {
            template: 'qoq-eslint-v9-ts-vitest',
            files: ['packages/**/src/**/*.spec.ts'],
            ignores: [],
            ...
        }
        ...
    ]
}
```

# Stylelint

**Optional check.** Stylelint runs only when a `stylelint` block is present in `qoq.config.js`; omit the block entirely to disable it. The orchestrator ships two compliant templates, [@ladamczyk/qoq-stylelint-css](https://www.npmjs.com/package/@ladamczyk/qoq-stylelint-css) and [@ladamczyk/qoq-stylelint-scss](https://www.npmjs.com/package/@ladamczyk/qoq-stylelint-scss); the wizard installs the one you pick.

Requires standard [configuration object](https://stylelint.io/user-guide/configure) but You can extend QoQ templates via `template` prop in each config where value is valid [@ladamczyk/qoq-stylelint-\*](https://www.npmjs.com/search?q=%40ladamczyk%2Fqoq-stylelint-) package eg:

```js
{
    stylelint: {
        strict: false,
        template: 'qoq-stylelint-css', // or 'qoq-stylelint-scss'
        ...
    }
}
```

where:

- `template` is a valid `@ladamczyk/qoq-stylelint-*` package — `qoq-stylelint-css` or `qoq-stylelint-scss`.
- `strict` is `boolean`; when `true` the check fails on warnings (not only errors). Defaults to `false`.

# Structurelint

**Optional check.** Structurelint validates a project's file/folder structure against rules you define, and runs only when a `structurelint` block is present in `qoq.config.js`; omit the block entirely to disable it. It is backed by the compliant [@ladamczyk/structurelint](https://www.npmjs.com/package/@ladamczyk/structurelint) package, which the wizard installs when you enable it. It executes before Skillslint. The `structurelint` block mirrors structurelint's own config shape directly — no separate `structure.config.*` file is read.

```js
{
    structurelint: {
        structureRoot: '.',
        structure: [{ name: 'src', children: [] }],
    }
}
```

where:

- `structure` is required to get any validation — an array describing the expected file/folder structure.
- `structureRoot` is `string` overriding the root folder to validate. Defaults to `.`.
- `rules` and `ignorePatterns` are also supported, mirroring `@ladamczyk/structurelint`'s own config shape.

# Skillslint

**Optional check.** Skillslint lints Claude Code skill documentation (textlint-based) and runs only when a `skillslint` block is present in `qoq.config.js`; omit the block entirely to disable it. It is backed by the compliant [@ladamczyk/skillslint](https://www.npmjs.com/package/@ladamczyk/skillslint) package, which the wizard installs when you enable it.

```js
{
    skillslint: {
        path: './skills',
    }
}
```

where:

- `path` is `string` pointing at the directory of skill docs to lint. Defaults to `./skills`.

# Scan

`qoq scan` checks `package-lock.json` dependencies for known vulnerabilities. It is on-demand only: it never runs as part of `--check`, `--fix` or `staged`, and has no `--skip-*` flag.

```bash
qoq scan [--json] [--output <path>] [--timeout <ms>] [--production] [--graph] [--silent]
```

- `--json` writes `scan-report.json` (`{ status, reason?, adapter, findings[] }`) to `--output`, default `bin/report`.
- `--timeout` overrides `scan.timeout`.
- `--production` scans production dependencies only.
- `--graph` prints, under the table, each vulnerable `name@version` as an inverted tree of the packages that pull it in, up to the `package.json` (root or workspace) and dependency field that declares each chain. A package already expanded prints `(see above)`; a loop prints `(cycle)`. Built from `package-lock.json` alone — no network, no `npm ls`.
- `--silent` suppresses the status line on the console.

Limits:

- **Lockfile only.** Reads `package-lock.json` (`lockfileVersion` ≥ 2) from the current directory. No pnpm, yarn or shrinkwrap. Inside a workspace member there is no lockfile, so the scan reports `skipped (no package-lock.json)`.
- **Registry only.** Only packages resolved from `https://registry.npmjs.org/` are sent to the scanner. Private registry names never leave the machine. Entries with no `version` are skipped.
- **Proxy.** Node's `fetch` ignores `HTTPS_PROXY`, so behind a proxy the default OSV scan reports `inconclusive` (`<fetch error>` or `timeout after Nms`) and exits `0`.
- **Exit codes.** Exit `1` only for a complete scan with a finding at or above `failOn`. `skipped` and `inconclusive` always exit `0`.

Configured via a top-level `scan` block:

- `adapter` — `{ name, scan(deps, { signal }) }`. Defaults to OSV.dev (`api.osv.dev`, no key).
- `timeout` — milliseconds, default `10000`.
- `failOn` — `low`, `moderate`, `high`, `critical` or `none`, default `high`. Unrated advisories count as `critical`.

## Writing your own adapter

An adapter swaps OSV.dev for any other source, such as an internal audit service or a commercial API. Everything outside `scan()` stays with qoq: reading the lockfile, the timeout, sorting, the table, `--graph`, the JSON report and the exit code.

**1. Take the dependencies.** `scan(deps, { signal })` receives `IScanDependency[]`:

| field     | type      | notes                                             |
| --------- | --------- | ------------------------------------------------- |
| `name`    | `string`  | real package name; aliases are already resolved   |
| `version` | `string`  | exact installed version                           |
| `dev`     | `boolean` | `true` only when every installed copy is dev-only |

The list is already deduplicated by `name@version` and holds only packages from `https://registry.npmjs.org/`. Under `--production`, dev-only packages are already filtered out.

**2. Query your source, passing `signal` to every request.** The signal aborts at `timeout`. qoq then waits 1s for the adapter to settle and returns a partial result. If nothing comes back, the run reports `skipped (timeout after Nms)`.

**3. Map each advisory to an `IScanFinding`.** Each package × advisory pair is one finding:

| field        | type     | notes                                                                                                                     |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `package`    | `string` | must match a `deps[].name` so `--graph` can find it                                                                       |
| `version`    | `string` | must match the dependency's `version`                                                                                     |
| `id`         | `string` | advisory ID shown in the table, e.g. `GHSA-…` or `CVE-…`                                                                  |
| `severity`   | `string` | `low`, `moderate` (or `medium`), `high`, `critical`; anything else becomes `unknown`, which `failOn` treats as `critical` |
| `fixVersion` | `string` | optional; lowest version that fixes it, shown in the `fix` column                                                         |
| `url`        | `string` | optional; links the `ID` cell (OSC 8 hyperlink, only when colour is on) and is kept in `scan-report.json`                 |

A missing optional field shows `-`, and a non-string value is dropped. Sorting, critical → high → moderate → low → unknown, happens after the adapter returns.

**4. Resolve `{ findings, complete, reason? }`.**

- `complete: true`: every dependency was checked, giving status `clean` or `findings`.
- `complete: false` plus a `reason`: some queries failed. Return what you have; the run reports `inconclusive (<reason>)`, still prints the partial findings and exits `0`.

A throw becomes `skipped (<error message>)`, and a result without a `findings` array becomes `skipped (adapter returned an invalid result)`. Both exit `0`, so a broken scanner never blocks a run. Only a complete scan with a finding at or above `failOn` exits `1`.

**5. Register it** in the top-level `scan` block of `qoq.config.js`. The types are exported from `@ladamczyk/qoq-cli`:

```ts
import type { IScanAdapter, IScanFinding, QoqConfig } from '@ladamczyk/qoq-cli';

const adapter: IScanAdapter = {
  name: 'internal-audit', // written as `adapter` in scan-report.json
  async scan(deps, { signal }) {
    const res = await fetch('https://audit.example.com/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(deps.map(({ name, version }) => ({ name, version }))),
      signal,
    });
    if (!res.ok) {
      return { findings: [], complete: false, reason: `HTTP ${res.status}` };
    }
    const advisories = (await res.json()) as {
      pkg: string;
      ver: string;
      id: string;
      level: string;
      fixed?: string;
    }[];
    const findings: IScanFinding[] = advisories.map((a) => ({
      package: a.pkg,
      version: a.ver,
      id: a.id,
      severity: a.level as IScanFinding['severity'],
      ...(a.fixed && { fixVersion: a.fixed }),
      url: `https://audit.example.com/advisories/${encodeURIComponent(a.id)}`,
    }));
    return { findings, complete: true };
  },
};

export default {
  scan: {
    adapter,
    timeout: 20000,
    failOn: 'moderate',
  },
} satisfies QoqConfig;
```

**6. Check it.** Run `qoq scan --json --graph`. Every finding should show in the table, every one should have a tree under `--graph` (a finding with no tree means its `package`/`version` doesn't match a dependency), and `bin/report/scan-report.json` should name your adapter.

Status line: `scan: clean`, `scan: 1 finding` / `scan: N findings`, `scan: skipped (<reason>)` or `scan: inconclusive (<reason>)`.

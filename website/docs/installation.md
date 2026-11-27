---
sidebar_position: 2
title: Installation
description: Install the CLI, run the Config Wizard, and wire up the generated config files.
---

# Installation

Install the CLI as a dev dependency:

```bash
npm install @ladamczyk/qoq-cli
```

Then run the **Config Wizard**, which interviews you about your project, installs the matching `@ladamczyk/qoq-*` presets (plus `@ladamczyk/structurelint` if you opt into structure linting, `@ladamczyk/skillslint` if you opt into agent-skills linting, and `@ladamczyk/justify-disable` if you set lint-disable justification to `warn` or `error`), and generates the config files for you:

```bash
npx -y @ladamczyk/qoq-cli --init
```

The wizard creates three files in your project root, plus a fourth if you opt into Stylelint:

| File                  | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `.prettierrc`         | Enables IDE formatting from a pre-configured template.                    |
| `eslint.config.js`    | Connects the CLI-generated ESLint config to your IDE.                     |
| `stylelint.config.js` | Connects the CLI-generated Stylelint config to your IDE (Stylelint only). |
| `qoq.config.js`       | Configuration consumed by the CLI itself.                                 |

If no config file is found, the CLI will offer to create one whenever you run `--check` or `--fix`.

## Warmup hook

QoQ regenerates each tool's config on execution, so a freshly checked-out project (or one that hasn't run yet) may reference an ESLint config file that doesn't exist yet. Add a warmup step to your `package.json` to materialize it after install:

```json
{
  "scripts": {
    "postinstall": "qoq --warmup"
  }
}
```

This is intentionally **not** bundled into the package: `postinstall` scripts are a common supply-chain risk, and `pnpm` ignores them entirely.

## Manual configuration

If you prefer to wire things up yourself, create the three files by hand:

1. **`.prettierrc`** — your own config, or a QoQ template, e.g. `"@ladamczyk/qoq-prettier"`.
2. **`eslint.config.js`** — re-export the CLI's generated config:

   ```js
   // CommonJS
   const config = require('@ladamczyk/qoq-cli/bin/eslint.config.cjs');
   module.exports = config;
   ```

   ```js
   // ESM
   import config from '@ladamczyk/qoq-cli/bin/eslint.config.mjs';
   export default config;
   ```

3. **`stylelint.config.js`** (only if you enable the Stylelint check) — re-export the CLI's generated config the same way:

   ```js
   // CommonJS
   const config = require('@ladamczyk/qoq-cli/bin/stylelint.config.cjs');
   module.exports = config;
   ```

   ```js
   // ESM
   import config from '@ladamczyk/qoq-cli/bin/stylelint.config.mjs';
   export default config;
   ```

4. **`qoq.config.js`** — the CLI configuration object described in [Configuration](./configuration.md) (CommonJS or ESM).

Run `qoq -h` (or `qoq --help`) at any time for the full list of CLI options. A few worth knowing about:

- `qoq [...tools]` — restrict a run to specific tools (e.g. `qoq eslint prettier`), on top of the usual `--check`/`--fix`.
- `--json --output <path>` — write each tool's results as JSON reports instead of (or alongside) console output.
- `--concurrency auto` — run tools in parallel where possible (default `off`).
- `--skip-<tool>` (e.g. `--skip-knip`, `--skip-structurelint`) — drop a single tool from an otherwise full run, for both the default command and `qoq staged`.
- `qoq scan` — separate on-demand vulnerability scan of `package-lock.json`, never part of `--check`, `--fix` or `staged`. See [Scan](./configuration.md#scan).
- `--disable-cache` — bypass the per-tool caches (ESLint, Stylelint, Prettier) and force a full re-run.
- `--production` — run tools in production mode (Knip excludes dev-only rules).
- `--config-hints` — print config suggestions (currently Knip's) alongside check results.
- `--silent` — suppress all QoQ console output; `CI=true` in the environment is treated the same way, so CI logs stay short unless you pass an explicit flag to override it.

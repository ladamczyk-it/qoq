---
sidebar_position: 2
title: Installation | v4.x
sidebar_label: Installation | v4.x
description: 'Install the QoQ 4.x CLI, run the Config Wizard, migrate from @saashub/qoq-*, and wire the generated configs into your IDE. | v4.x'
---

Install the CLI as a dev dependency:

```bash
npm install --save-dev @ladamczyk/qoq-cli@4
```

Then run the **Config Wizard**, which installs the matching `@ladamczyk/qoq-*` presets and writes the config files:

```bash
npx -y @ladamczyk/qoq-cli@4 --init
```

## Migrating from `@saashub/qoq-*`

3.x shipped as `@saashub/qoq-*`. 4.0 renamed every package to `@ladamczyk/qoq-*` with no code change:

```bash
npm uninstall @saashub/qoq-cli
npm install --save-dev @ladamczyk/qoq-cli@4
```

Then replace `@saashub/` with `@ladamczyk/` in `.prettierrc`, `eslint.config.js`, `stylelint.config.js` and every preset in `package.json`.

## Generated files

- `.prettierrc` — the Prettier template, for IDE formatting.
- `eslint.config.js` — connects the CLI-generated ESLint config with your IDE.
- `stylelint.config.js` — only when you enable Stylelint.
- `qoq.config.js` — the CLI's own [configuration](./configuration.md).

If no config file is found, every `--check` or `--fix` asks to create one.

## Manual setup

```js
import config from '@ladamczyk/qoq-cli/bin/eslint.config.mjs';

export default config;
```

CommonJS uses `require('@ladamczyk/qoq-cli/bin/eslint.config.cjs')`; Stylelint uses `bin/stylelint.config.{cjs,mjs}`.

## Warmup

Add `"postinstall": "qoq --warmup"` to your `scripts` so `eslint.config.js` has a generated config to import on a fresh checkout. QoQ doesn't add it itself: third-party `postinstall` scripts are treated as suspicious, and `pnpm` ignores them.

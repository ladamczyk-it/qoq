---
sidebar_position: 2
title: Installation | v6.x
sidebar_label: Installation | v6.x
description: 'Install the QoQ 6.x CLI, run the Config Wizard, and wire the generated ESLint, Prettier and Stylelint configs into your IDE. | v6.x'
---

Install the CLI as a dev dependency:

```bash
npm install --save-dev @ladamczyk/qoq-cli@6
```

Then run the **Config Wizard**. It asks about your stack, installs the matching `@ladamczyk/qoq-*` presets (and `@ladamczyk/structurelint`, `@ladamczyk/skillslint` or `@ladamczyk/justify-disable` when you opt into them), and writes the config files:

```bash
npx -y @ladamczyk/qoq-cli@6 --init
```

## Generated files

- `.prettierrc` — the Prettier template, for IDE formatting.
- `eslint.config.js` — connects the CLI-generated ESLint config with your IDE.
- `stylelint.config.js` — only when you enable Stylelint.
- `qoq.config.js` — the CLI's own [configuration](./configuration.md).

If no config file is found, `qoq --check` and `qoq --fix` offer to run the wizard.

## Manual setup

`eslint.config.js` re-exports the config the CLI generates:

```js
import config from '@ladamczyk/qoq-cli/bin/eslint.config.mjs';

export default config;
```

CommonJS uses `require('@ladamczyk/qoq-cli/bin/eslint.config.cjs')`. Stylelint follows the same pattern with `bin/stylelint.config.{cjs,mjs}`. From 6.0 the generated ESLint config is composed with ESLint's own `defineConfig`, so the presets must export `configs.base`.

## Warmup

The CLI re-creates each tool's config on every run, so a fresh checkout has nothing for `eslint.config.js` to import yet. Add a `postinstall` script:

```json
{
  "scripts": {
    "postinstall": "qoq --warmup"
  }
}
```

QoQ doesn't add it itself: third-party `postinstall` scripts are treated as suspicious, and `pnpm` ignores them.

## The qoq skill

```text
/plugin marketplace add ladamczyk-it/qoq
/plugin install qoq@qoq-agent-skills
```

See [The qoq skill](./skill.md).
